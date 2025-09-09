/*
 * Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved.
 * Copyright 2025 Superstruct Ltd, New Zealand
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * WASM wrapper for Zstandard compression library
 */

#include "zstd.h"
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

// WASM-exported functions for zstd compression and decompression

EMSCRIPTEN_KEEPALIVE
int zstd_compress_buffer(const char* input, int input_len, char* output, unsigned int* output_len, int compression_level) {
    size_t result = ZSTD_compress(output, *output_len, input, input_len, compression_level);
    
    if (ZSTD_isError(result)) {
        return -1; // Error
    }
    
    *output_len = (unsigned int)result;
    return 0; // Success
}

EMSCRIPTEN_KEEPALIVE
int zstd_decompress_buffer(const char* input, int input_len, char* output, unsigned int* output_len) {
    size_t result = ZSTD_decompress(output, *output_len, input, input_len);
    
    if (ZSTD_isError(result)) {
        return -1; // Error
    }
    
    *output_len = (unsigned int)result;
    return 0; // Success
}

EMSCRIPTEN_KEEPALIVE
unsigned int zstd_compress_bound(unsigned int source_len) {
    return (unsigned int)ZSTD_compressBound(source_len);
}

EMSCRIPTEN_KEEPALIVE
const char* zstd_get_version(void) {
    static char version_str[16];
    unsigned int version = ZSTD_versionNumber();
    snprintf(version_str, sizeof(version_str), "%d.%d.%d", 
             version / 10000, (version / 100) % 100, version % 100);
    return version_str;
}

EMSCRIPTEN_KEEPALIVE
const char* zstd_error_string(int error_code) {
    if (error_code == 0) {
        return "ZSTD_OK";
    }
    return "ZSTD_ERROR";
}

EMSCRIPTEN_KEEPALIVE
unsigned long long zstd_get_decompressed_size(const char* input, int input_len) {
    return ZSTD_getFrameContentSize(input, input_len);
}

// TypeScript API wrapper functions for compatibility
EMSCRIPTEN_KEEPALIVE
int zstd_compress_optimized(const char* input, int input_len, char* output, unsigned int* output_len, int compression_level) {
    return zstd_compress_buffer(input, input_len, output, output_len, compression_level);
}

EMSCRIPTEN_KEEPALIVE
int zstd_decompress_optimized(const char* input, int input_len, char* output, unsigned int* output_len) {
    return zstd_decompress_buffer(input, input_len, output, output_len);
}

EMSCRIPTEN_KEEPALIVE
unsigned int zstd_compress_bound_optimized(unsigned int source_len) {
    return zstd_compress_bound(source_len);
}

EMSCRIPTEN_KEEPALIVE
const char* zstd_get_version_optimized(void) {
    return zstd_get_version();
}

EMSCRIPTEN_KEEPALIVE
const char* zstd_get_error_name_optimized(int error_code) {
    return zstd_error_string(error_code);
}

// Standard API aliases
EMSCRIPTEN_KEEPALIVE
int zstd_compress(const char* input, int input_len, char* output, unsigned int* output_len, int compression_level) {
    return zstd_compress_buffer(input, input_len, output, output_len, compression_level);
}

EMSCRIPTEN_KEEPALIVE
int zstd_decompress(const char* input, int input_len, char* output, unsigned int* output_len) {
    return zstd_decompress_buffer(input, input_len, output, output_len);
}

EMSCRIPTEN_KEEPALIVE
const char* zstd_get_error_name(int error_code) {
    return zstd_error_string(error_code);
}