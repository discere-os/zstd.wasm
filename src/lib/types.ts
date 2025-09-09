/**
 * Type definitions for zstd.wasm
 * Professional, type-safe interface for high-performance compression
 */

// Core WASM module interface
export interface ZstdModule {
  // High-performance optimized functions
  _zstd_compress_buffer_optimized?(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number,
    compressionLevel: number
  ): number
  
  _zstd_decompress_buffer_optimized?(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number
  ): number

  _zstd_compress_fast?(input: number, inputLen: number, output: number, outputLen: number): number
  _zstd_decompress_fast?(input: number, inputLen: number, output: number, outputLen: number): number
  _zstd_compress_batch?(inputs: number, inputLens: number, numInputs: number, outputs: number, outputLens: number, level: number): number
  _zstd_get_optimization_info?(): number

  // Standard optimized functions  
  _zstd_compress_optimized?(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number,
    compressionLevel: number
  ): number
  
  _zstd_decompress_optimized?(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number
  ): number

  _zstd_compress_bound_optimized?(inputLen: number): number
  _zstd_get_version_optimized?(): number
  _zstd_get_error_name_optimized?(errorCode: number): number

  // Standard fallback functions
  _zstd_compress(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number,
    compressionLevel: number
  ): number
  
  _zstd_decompress(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number
  ): number

  _zstd_compress_bound(inputLen: number): number
  _zstd_get_version(): number
  _zstd_get_error_name(errorCode: number): number

  // Optional optimized memory management
  _zstd_init_optimized_memory?(): void
  _zstd_cleanup_optimized_memory?(): void

  // Memory management
  _malloc(size: number): number
  _free(ptr: number): void

  // Runtime interface
  HEAPU8: Uint8Array
  setValue(ptr: number, value: number, type: 'i8' | 'i16' | 'i32' | 'float' | 'double'): void
  getValue(ptr: number, type: 'i8' | 'i16' | 'i32' | 'float' | 'double'): number
  UTF8ToString?(ptr: number): string
  AsciiToString?(ptr: number): string
}

// Extended navigator interface for device memory
export interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

// Compression configuration
export interface CompressionOptions {
  /** Compression level (1=fast, 3=default, 19=maximum) */
  level?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19
  /** Use dictionary compression */
  useDictionary?: boolean
  /** Enable long-range matching */
  enableLongRange?: boolean
}

// Compression result with performance metrics
export interface CompressionResult {
  /** Compressed data */
  compressed: Uint8Array
  /** Compression ratio (original/compressed) */
  compressionRatio: number
  /** Time taken in milliseconds */
  compressionTime: number
  /** Compression speed in KB/s */
  compressionSpeed: number
  /** Space saved as percentage */
  spaceSaved: number
  /** Content hash for verification */
  contentHash: number
}

// Decompression result with validation
export interface DecompressionResult {
  /** Decompressed data */
  decompressed: Uint8Array
  /** Time taken in milliseconds */
  decompressionTime: number
  /** Decompression speed in KB/s */
  decompressionSpeed: number
  /** Round-trip validation successful */
  isValid: boolean
  /** Content hash verification */
  hashValid: boolean
}

// Performance monitoring
export interface PerformanceMetrics {
  /** Number of compression operations */
  compressionOps: number
  /** Number of decompression operations */
  decompressionOps: number
  /** Average compression speed in KB/s */
  averageCompressionSpeed: number
  /** Average decompression speed in KB/s */
  averageDecompressionSpeed: number
  /** Total compression time in milliseconds */
  totalCompressionTime: number
  /** Total decompression time in milliseconds */
  totalDecompressionTime: number
  /** Whether SIMD acceleration is active */
  simdAcceleration: boolean
}

// Module initialization options
export interface InitializationOptions {
  /** Prefer optimized build with SIMD */
  preferOptimized?: boolean
  /** Enable performance monitoring */
  enableMetrics?: boolean
  /** Custom WASM module path */
  wasmPath?: string
}

// Capability detection
export interface SystemCapabilities {
  /** WebAssembly support */
  wasmSupported: boolean
  /** SIMD instruction support */
  simdSupported: boolean
  /** Memory size estimation */
  estimatedMemory: number | undefined
  /** CPU core count */
  coreCount: number | undefined
}

// Benchmark result structure
export interface BenchmarkResult {
  /** Test data characteristics */
  dataType: 'text' | 'json' | 'binary' | 'random'
  /** Input size in bytes */
  inputSize: number
  /** Results per compression level */
  results: Record<number, {
    compressionSpeed: number
    decompressionSpeed: number
    compressionRatio: number
    spaceSaved: number
    time: number
  }>
  /** Optimal configuration recommendation */
  recommendation: {
    fastestCompression: number
    bestRatio: number
    balanced: number
  }
}

// File processing result
export interface FileCompressionResult {
  /** Original filename */
  fileName: string
  /** Original file size */
  originalSize: number
  /** Compressed data */
  compressedData: Uint8Array
  /** Compression metrics */
  metrics: CompressionResult
  /** Suggested filename for compressed file */
  suggestedFilename: string
}