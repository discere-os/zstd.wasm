/*
 * Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved.
 * Copyright 2025 Superstruct Ltd, New Zealand
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface WASMModuleManifest {
  name: string;
  version: string;
  tier: 1 | 2 | 3;
  dependencies: string[];
  variants: Record<string, WASMVariant>;
  capabilities: WASMCapabilities;
  exports: Record<string, string>;
}

export interface WASMVariant {
  wasm: string;
  js: string;
  size_bytes: number;
  gzip_size_bytes: number;
  features: string[];
}

export interface WASMCapabilities {
  simd: boolean;
  threading: boolean;
  webgpu: boolean;
  memory_min: number;
  memory_recommended: number;
}

export declare class WASMModuleInterface {
  constructor(instance: WebAssembly.Instance, manifest: WASMModuleManifest);
  malloc(size: number): number;
  free(ptr: number): void;
  getLastError(): string;
  writeString(str: string): number;
  readString(ptr: number): string;
  
  // ZSTD-specific methods
  compress(data: Uint8Array, compressionLevel?: number): Uint8Array;
  decompress(compressedData: Uint8Array, decompressedSize?: number): Uint8Array;
  getVersion(): string;
  hasSIMD(): boolean;
  benchmarkCompression(data: Uint8Array, compressionLevel?: number, iterations?: number): number;
}

export declare class WASMLoader {
  constructor(basePath?: string);
  load(variant?: string): Promise<WASMModuleInterface>;
  loadManifest(): Promise<WASMModuleManifest>;
}

export default WASMModuleInterface;