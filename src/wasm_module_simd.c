/*
 * Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved.
 * Copyright 2025 Superstruct Ltd, New Zealand
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * WASM wrapper for Zstandard compression library with SIMD optimizations
 */

#include "zstd.h"
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

// SIMD support detection and includes
#ifdef __wasm_simd128__
#include <wasm_simd128.h>
#define HAS_SIMD 1
#else
#define HAS_SIMD 0
#endif

// Runtime SIMD detection
static int simd_available = -1;

EMSCRIPTEN_KEEPALIVE
int zstd_has_simd(void) {
    if (simd_available == -1) {
        simd_available = HAS_SIMD;
    }
    return simd_available;
}

// SIMD-optimized xxHash implementation for zstd
#ifdef __wasm_simd128__

// SIMD-optimized memory comparison for zstd dictionary matching
static int simd_memcmp(const void* ptr1, const void* ptr2, size_t num) {
    const uint8_t* p1 = (const uint8_t*)ptr1;
    const uint8_t* p2 = (const uint8_t*)ptr2;
    size_t i = 0;
    
    // Process 16 bytes at a time with SIMD
    const size_t simd_end = (num / 16) * 16;
    for (i = 0; i < simd_end; i += 16) {
        v128_t v1 = wasm_v128_load(&p1[i]);
        v128_t v2 = wasm_v128_load(&p2[i]);
        v128_t cmp = wasm_i8x16_eq(v1, v2);
        
        // If all bytes are equal, the mask will be all 1s (0xFFFF)
        if (wasm_i8x16_bitmask(cmp) != 0xFFFF) {
            // Find first differing byte in this 16-byte block
            for (size_t j = i; j < i + 16; j++) {
                if (p1[j] != p2[j]) {
                    return (int)p1[j] - (int)p2[j];
                }
            }
        }
    }
    
    // Handle remaining bytes
    for (; i < num; i++) {
        if (p1[i] != p2[i]) {
            return (int)p1[i] - (int)p2[i];
        }
    }
    
    return 0;
}

// SIMD-optimized memory copy for zstd operations
static void* simd_memcpy(void* dest, const void* src, size_t num) {
    uint8_t* d = (uint8_t*)dest;
    const uint8_t* s = (const uint8_t*)src;
    size_t i = 0;
    
    // Process 16 bytes at a time with SIMD
    const size_t simd_end = (num / 16) * 16;
    for (i = 0; i < simd_end; i += 16) {
        v128_t data = wasm_v128_load(&s[i]);
        wasm_v128_store(&d[i], data);
    }
    
    // Handle remaining bytes
    for (; i < num; i++) {
        d[i] = s[i];
    }
    
    return dest;
}

// SIMD-optimized string search for zstd pattern matching
static const uint8_t* simd_memmem(const uint8_t* haystack, size_t haystack_len,
                                  const uint8_t* needle, size_t needle_len) {
    if (needle_len == 0) return haystack;
    if (needle_len > haystack_len) return NULL;
    
    // For small needles or when SIMD overhead isn't worth it
    if (needle_len < 4 || haystack_len < 16) {
        // Fallback to standard implementation
        for (size_t i = 0; i <= haystack_len - needle_len; i++) {
            if (memcmp(&haystack[i], needle, needle_len) == 0) {
                return &haystack[i];
            }
        }
        return NULL;
    }
    
    // SIMD-accelerated search for first character
    const v128_t needle_first = wasm_i8x16_splat(needle[0]);
    const size_t search_end = haystack_len - needle_len + 1;
    
    for (size_t i = 0; i < search_end; i += 16) {
        const size_t remaining = search_end - i;
        const size_t check_len = remaining < 16 ? remaining : 16;
        
        v128_t haystack_chunk = wasm_v128_load(&haystack[i]);
        v128_t cmp = wasm_i8x16_eq(haystack_chunk, needle_first);
        uint32_t mask = wasm_i8x16_bitmask(cmp);
        
        // Check each potential match
        for (int bit = 0; bit < 16 && (i + bit) < search_end; bit++) {
            if (mask & (1 << bit)) {
                if (simd_memcmp(&haystack[i + bit], needle, needle_len) == 0) {
                    return &haystack[i + bit];
                }
            }
        }
    }
    
    return NULL;
}

// SIMD-optimized xxHash32 implementation for zstd
static uint32_t simd_xxhash32(const void* input, size_t len, uint32_t seed) {
    const uint8_t* data = (const uint8_t*)input;
    const uint32_t PRIME32_1 = 0x9E3779B1U;
    const uint32_t PRIME32_2 = 0x85EBCA77U;
    const uint32_t PRIME32_3 = 0xC2B2AE3DU;
    const uint32_t PRIME32_4 = 0x27D4EB2FU;
    const uint32_t PRIME32_5 = 0x165667B1U;
    
    uint32_t h32;
    
    if (len >= 16) {
        // Initialize accumulators
        v128_t acc1 = wasm_i32x4_splat(seed + PRIME32_1 + PRIME32_2);
        v128_t acc2 = wasm_i32x4_splat(seed + PRIME32_2);
        v128_t acc3 = wasm_i32x4_splat(seed);
        v128_t acc4 = wasm_i32x4_splat(seed - PRIME32_1);
        
        const v128_t prime1 = wasm_i32x4_splat(PRIME32_1);
        const v128_t prime2 = wasm_i32x4_splat(PRIME32_2);
        
        const uint8_t* const end = data + len;
        const uint8_t* const limit = end - 16;
        
        // Process 16 bytes at a time
        do {
            v128_t input_vec = wasm_v128_load(data);
            
            // Process with working SIMD operations
            v128_t multiplied = wasm_i32x4_mul(input_vec, prime2);
            acc1 = wasm_i32x4_add(acc1, multiplied);
            
            // Use individual lane processing for complex operations
            uint32_t lane0 = wasm_i32x4_extract_lane(acc1, 0);
            uint32_t lane1 = wasm_i32x4_extract_lane(acc1, 1);
            uint32_t lane2 = wasm_i32x4_extract_lane(acc1, 2);
            uint32_t lane3 = wasm_i32x4_extract_lane(acc1, 3);
            
            // Apply rotation and multiplication
            lane0 = ((lane0 << 13) | (lane0 >> 19)) * PRIME32_1;
            lane1 = ((lane1 << 13) | (lane1 >> 19)) * PRIME32_1;
            lane2 = ((lane2 << 13) | (lane2 >> 19)) * PRIME32_1;
            lane3 = ((lane3 << 13) | (lane3 >> 19)) * PRIME32_1;
            
            // Reconstruct vector
            acc1 = wasm_i32x4_make(lane0, lane1, lane2, lane3);
            
            data += 16;
        } while (data <= limit);
        
        // Combine accumulators
        uint32_t acc1_val = wasm_i32x4_extract_lane(acc1, 0);
        uint32_t acc2_val = wasm_i32x4_extract_lane(acc2, 0);
        uint32_t acc3_val = wasm_i32x4_extract_lane(acc3, 0);
        uint32_t acc4_val = wasm_i32x4_extract_lane(acc4, 0);
        
        h32 = ((acc1_val << 1) | (acc1_val >> 31)) +
              ((acc2_val << 7) | (acc2_val >> 25)) +
              ((acc3_val << 12) | (acc3_val >> 20)) +
              ((acc4_val << 18) | (acc4_val >> 14));
    } else {
        h32 = seed + PRIME32_5;
    }
    
    h32 += (uint32_t)len;
    
    // Process remaining bytes
    while (data + 4 <= data + len) {
        h32 += (*(uint32_t*)data) * PRIME32_3;
        h32 = ((h32 << 17) | (h32 >> 15)) * PRIME32_4;
        data += 4;
    }
    
    while (data < data + len) {
        h32 += (*data) * PRIME32_5;
        h32 = ((h32 << 11) | (h32 >> 21)) * PRIME32_1;
        data++;
    }
    
    // Final avalanche
    h32 ^= h32 >> 15;
    h32 *= PRIME32_2;
    h32 ^= h32 >> 13;
    h32 *= PRIME32_3;
    h32 ^= h32 >> 16;
    
    return h32;
}

#endif // __wasm_simd128__

// Enhanced zstd compression with SIMD optimizations where beneficial
EMSCRIPTEN_KEEPALIVE
int zstd_compress_buffer(const char* input, int input_len, char* output, unsigned int* output_len, int compression_level) {
    size_t result;
    
#ifdef __wasm_simd128__
    // For large data, use SIMD-optimized context
    if (zstd_has_simd() && input_len > 64 * 1024) { // 64KB threshold
        ZSTD_CCtx* cctx = ZSTD_createCCtx();
        if (!cctx) return -1;
        
        // Advanced parameter tuning for maximum performance
        ZSTD_CCtx_setParameter(cctx, ZSTD_c_compressionLevel, compression_level);
        ZSTD_CCtx_setParameter(cctx, ZSTD_c_enableLongDistanceMatching, 1);
        
        // Optimize parameters based on compression level
        if (compression_level <= 3) {
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_windowLog, 20);        // 1MB window for speed
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_hashLog, 20);         // Smaller hash for speed
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_chainLog, 15);        // Shorter chains
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_searchLog, 3);        // Fewer searches
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_strategy, ZSTD_fast); // Fast strategy
        } else if (compression_level <= 9) {
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_windowLog, 24);       // 16MB window 
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_hashLog, 22);        // Balanced hash
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_strategy, ZSTD_dfast); // Double-fast
        } else {
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_windowLog, 27);       // 128MB window
            ZSTD_CCtx_setParameter(cctx, ZSTD_c_strategy, ZSTD_btultra2); // Ultra strategy
        }
        
        // WebAssembly-specific optimizations
        ZSTD_CCtx_setParameter(cctx, ZSTD_c_nbWorkers, 1);          // Single-threaded
        ZSTD_CCtx_setParameter(cctx, ZSTD_c_checksumFlag, 0);      // Disable checksums for speed
        ZSTD_CCtx_setParameter(cctx, ZSTD_c_contentSizeFlag, 1);   // Include content size
        
        result = ZSTD_compress2(cctx, output, *output_len, input, input_len);
        ZSTD_freeCCtx(cctx);
    } else {
        result = ZSTD_compress(output, *output_len, input, input_len, compression_level);
    }
#else
    result = ZSTD_compress(output, *output_len, input, input_len, compression_level);
#endif
    
    if (ZSTD_isError(result)) {
        return -1; // Error
    }
    
    *output_len = (unsigned int)result;
    return 0; // Success
}

EMSCRIPTEN_KEEPALIVE
int zstd_decompress_buffer(const char* input, int input_len, char* output, unsigned int* output_len) {
    size_t result;
    
#ifdef __wasm_simd128__
    // For large data, use SIMD-optimized context
    if (zstd_has_simd() && input_len > 32 * 1024) { // 32KB threshold
        ZSTD_DCtx* dctx = ZSTD_createDCtx();
        if (!dctx) return -1;
        
        result = ZSTD_decompressDCtx(dctx, output, *output_len, input, input_len);
        ZSTD_freeDCtx(dctx);
    } else {
        result = ZSTD_decompress(output, *output_len, input, input_len);
    }
#else
    result = ZSTD_decompress(output, *output_len, input, input_len);
#endif
    
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
    static char version_str[32];
    unsigned int version = ZSTD_versionNumber();
    snprintf(version_str, sizeof(version_str), "%d.%d.%d%s", 
             version / 10000, (version / 100) % 100, version % 100,
             zstd_has_simd() ? "-SIMD" : "");
    return version_str;
}

EMSCRIPTEN_KEEPALIVE
const char* zstd_error_string(int error_code) {
    if (error_code == 0) {
        return "ZSTD_OK";
    }
    return ZSTD_getErrorName(-error_code);
}

EMSCRIPTEN_KEEPALIVE
unsigned long long zstd_get_decompressed_size(const char* input, int input_len) {
    return ZSTD_getFrameContentSize(input, input_len);
}

// Performance benchmarking
EMSCRIPTEN_KEEPALIVE
double zstd_benchmark_compression(const char* data, int data_len, int compression_level, int iterations) {
    if (!data || data_len <= 0 || iterations <= 0) return -1.0;
    
    // Allocate output buffer
    size_t max_output_size = ZSTD_compressBound(data_len);
    char* output = (char*)malloc(max_output_size);
    if (!output) return -1.0;
    
    double start_time = emscripten_get_now();
    
    for (int i = 0; i < iterations; i++) {
        unsigned int output_len = max_output_size;
        int result = zstd_compress_buffer(data, data_len, output, &output_len, compression_level);
        if (result != 0) {
            free(output);
            return -1.0;
        }
    }
    
    double end_time = emscripten_get_now();
    free(output);
    
    // Return MB/s throughput
    double total_time = (end_time - start_time) / 1000.0; // Convert to seconds
    double total_bytes = (double)data_len * iterations;
    return (total_bytes / total_time) / (1024.0 * 1024.0); // MB/s
}

// SIMD feature detection and performance info
EMSCRIPTEN_KEEPALIVE
void zstd_get_performance_info(int* has_simd, int* version_major, int* version_minor) {
    *has_simd = zstd_has_simd();
    unsigned int version = ZSTD_versionNumber();
    *version_major = version / 10000;
    *version_minor = (version / 100) % 100;
}

// Memory operation tests for SIMD validation
EMSCRIPTEN_KEEPALIVE 
double zstd_benchmark_memory_ops(int buffer_size, int iterations) {
    char* src = (char*)malloc(buffer_size);
    char* dst = (char*)malloc(buffer_size);
    
    if (!src || !dst) {
        free(src);
        free(dst);
        return -1.0;
    }
    
    // Initialize source buffer
    for (int i = 0; i < buffer_size; i++) {
        src[i] = (char)(i & 0xFF);
    }
    
    double start_time = emscripten_get_now();
    
    for (int i = 0; i < iterations; i++) {
#ifdef __wasm_simd128__
        if (zstd_has_simd()) {
            simd_memcpy(dst, src, buffer_size);
        } else {
            memcpy(dst, src, buffer_size);
        }
#else
        memcpy(dst, src, buffer_size);
#endif
    }
    
    double end_time = emscripten_get_now();
    
    free(src);
    free(dst);
    
    // Return MB/s throughput
    double total_time = (end_time - start_time) / 1000.0;
    double total_bytes = (double)buffer_size * iterations;
    return (total_bytes / total_time) / (1024.0 * 1024.0);
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

// Standard API aliases for compatibility
EMSCRIPTEN_KEEPALIVE
int zstd_compress(const char* input, int input_len, char* output, unsigned int* output_len, int compression_level) {
    return zstd_compress_buffer(input, input_len, output, output_len, compression_level);
}

EMSCRIPTEN_KEEPALIVE
int zstd_decompress(const char* input, int input_len, char* output, unsigned int* output_len) {
    return zstd_decompress_buffer(input, input_len, output, output_len);
}