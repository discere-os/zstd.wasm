/*
 * Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved.
 * Copyright 2025 Superstruct Ltd, New Zealand
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Standard interface that all forks must implement
export class WASMModuleInterface {
  constructor(instance, manifest) {
    this.instance = instance;
    this.manifest = manifest;
    this.memory = instance.exports.memory;
    this.exports = instance.exports;
  }

  // Required standard methods
  malloc(size) {
    return this.exports.malloc(size);
  }

  free(ptr) {
    this.exports.free(ptr);
  }

  getLastError() {
    const errorPtr = this.exports.get_last_error();
    return this.readString(errorPtr);
  }

  // Standard memory utilities
  writeString(str) {
    const bytes = new TextEncoder().encode(str + '\0');
    const ptr = this.malloc(bytes.length);
    const view = new Uint8Array(this.memory.buffer, ptr, bytes.length);
    view.set(bytes);
    return ptr;
  }

  readString(ptr) {
    const view = new Uint8Array(this.memory.buffer, ptr);
    const end = view.indexOf(0);
    return new TextDecoder().decode(view.slice(0, end));
  }

  // ZSTD-specific methods
  compress(data, compressionLevel = 3) {
    const inputPtr = this.malloc(data.length);
    const inputView = new Uint8Array(this.memory.buffer, inputPtr, data.length);
    inputView.set(data);

    const maxOutputSize = this.exports.zstd_compress_bound(data.length);
    const outputPtr = this.malloc(maxOutputSize);
    
    let outputSize = maxOutputSize;
    const outputSizePtr = this.malloc(4);
    new Uint32Array(this.memory.buffer, outputSizePtr, 1)[0] = outputSize;

    const result = this.exports.zstd_compress_buffer(
      inputPtr, data.length, outputPtr, outputSizePtr, compressionLevel
    );

    if (result !== 0) {
      this.free(inputPtr);
      this.free(outputPtr);
      this.free(outputSizePtr);
      throw new Error('Compression failed');
    }

    outputSize = new Uint32Array(this.memory.buffer, outputSizePtr, 1)[0];
    const compressed = new Uint8Array(this.memory.buffer, outputPtr, outputSize).slice();

    this.free(inputPtr);
    this.free(outputPtr);
    this.free(outputSizePtr);

    return compressed;
  }

  decompress(compressedData, decompressedSize) {
    const inputPtr = this.malloc(compressedData.length);
    const inputView = new Uint8Array(this.memory.buffer, inputPtr, compressedData.length);
    inputView.set(compressedData);

    let outputSize = decompressedSize;
    if (!outputSize) {
      outputSize = this.exports.zstd_get_decompressed_size(inputPtr, compressedData.length);
      if (outputSize === 0) {
        this.free(inputPtr);
        throw new Error('Cannot determine decompressed size');
      }
    }

    const outputPtr = this.malloc(outputSize);
    const outputSizePtr = this.malloc(4);
    new Uint32Array(this.memory.buffer, outputSizePtr, 1)[0] = outputSize;

    const result = this.exports.zstd_decompress_buffer(
      inputPtr, compressedData.length, outputPtr, outputSizePtr
    );

    if (result !== 0) {
      this.free(inputPtr);
      this.free(outputPtr);
      this.free(outputSizePtr);
      throw new Error('Decompression failed');
    }

    outputSize = new Uint32Array(this.memory.buffer, outputSizePtr, 1)[0];
    const decompressed = new Uint8Array(this.memory.buffer, outputPtr, outputSize).slice();

    this.free(inputPtr);
    this.free(outputPtr);
    this.free(outputSizePtr);

    return decompressed;
  }

  getVersion() {
    const versionPtr = this.exports.zstd_get_version();
    return this.readString(versionPtr);
  }

  hasSIMD() {
    return Boolean(this.exports.zstd_has_simd());
  }

  benchmarkCompression(data, compressionLevel = 3, iterations = 100) {
    if (!data || data.length === 0) return 0;
    
    const inputPtr = this.malloc(data.length);
    const inputView = new Uint8Array(this.memory.buffer, inputPtr, data.length);
    inputView.set(data);

    const result = this.exports.zstd_benchmark_compression(
      inputPtr, data.length, compressionLevel, iterations
    );

    this.free(inputPtr);
    return result;
  }
}

// Default export for ecosystem compatibility
export default WASMModuleInterface;