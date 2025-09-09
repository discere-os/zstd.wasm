/**
 * Comprehensive unit tests for zstd.wasm core functionality
 * Type-safe testing with realistic scenarios
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import Zstd, { formatSpeed, formatSize } from '../../lib/index.js'
import type { CompressionOptions } from '../../lib/types.js'

describe('zstd.wasm Core Functionality', () => {
  let zstd: Zstd

  beforeAll(async () => {
    zstd = new Zstd()
    await zstd.initialize({ enableMetrics: true })
  })

  afterAll(() => {
    zstd.cleanup()
  })

  describe('Module Initialization', () => {
    test('should initialize successfully', () => {
      expect(zstd).toBeDefined()
    })

    test('should report system capabilities', () => {
      const capabilities = zstd.getSystemCapabilities()
      expect(capabilities.wasmSupported).toBe(true)
      expect(typeof capabilities.simdSupported).toBe('boolean')
    })

    test('should provide version information', () => {
      const version = zstd.getVersion()
      expect(version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })

  describe('Compression Levels', () => {
    const testData = new TextEncoder().encode('Zstd compression test data. '.repeat(100))

    test('should handle key compression levels', () => {
      const levels = [1, 3, 9, 19] // Key zstd levels

      levels.forEach(level => {
        const result = zstd.compress(testData, { level })
        
        expect(result.compressed).toBeInstanceOf(Uint8Array)
        expect(result.compressionRatio).toBeGreaterThan(0)
        expect(result.compressionSpeed).toBeGreaterThan(0)
        expect(typeof result.contentHash).toBe('number')

        // Verify decompression
        const decompressed = zstd.decompress(result.compressed)
        expect(decompressed.decompressed.length).toBe(testData.length)
        expect(decompressed.isValid).toBe(true)
      })
    })

    test('should show performance characteristics by level', () => {
      const results: Array<{ level: number; speed: number; ratio: number }> = []

      for (const level of [1, 3, 9, 19]) {
        const result = zstd.compress(testData, { level })
        results.push({
          level,
          speed: result.compressionSpeed,
          ratio: result.compressionRatio
        })
      }

      console.log(`\n📊 Zstd Compression Level Performance:`)
      results.forEach(r => {
        console.log(`   Level ${r.level}: ${formatSpeed(r.speed)}, ${r.ratio.toFixed(2)}:1 ratio`)
      })

      // All levels should produce valid results
      results.forEach(r => {
        expect(r.speed).toBeGreaterThan(0)
        expect(r.ratio).toBeGreaterThan(0)
      })
    })

    test('should reject invalid compression levels', () => {
      expect(() => zstd.compress(testData, { level: 0 as any })).toThrow('Compression level must be between 1 and 19')
      expect(() => zstd.compress(testData, { level: 20 as any })).toThrow('Compression level must be between 1 and 19')
    })
  })

  describe('Large Data Handling', () => {
    test('should compress large text data efficiently', () => {
      const largeText = 'Zstd excels at both speed and compression ratio. '.repeat(5000) // ~250KB
      const textData = new TextEncoder().encode(largeText)
      
      console.log(`\n📊 Testing ${formatSize(textData.length)} text data`)

      const result = zstd.compress(textData, { level: 3 })
      const decompressed = zstd.decompress(result.compressed)
      
      console.log(`   Compressed: ${formatSize(result.compressed.length)} in ${result.compressionTime.toFixed(1)}ms`)
      console.log(`   Speed: ${formatSpeed(result.compressionSpeed)}`)
      console.log(`   Ratio: ${result.compressionRatio.toFixed(2)}:1 (${result.spaceSaved.toFixed(1)}% saved)`)

      // Zstd should achieve excellent compression on repetitive text
      expect(result.compressionRatio).toBeGreaterThan(10) // > 10:1 for repetitive text
      expect(decompressed.decompressed.length).toBe(textData.length)
      expect(decompressed.isValid).toBe(true)
    })

    test('should handle different data characteristics', () => {
      const dataSets = [
        {
          name: 'JSON data',
          data: new TextEncoder().encode(JSON.stringify({ 
            zstd: 'fast', 
            data: Array.from({ length: 500 }, (_, i) => ({ id: i, value: `item_${i}` }))
          }))
        },
        {
          name: 'Binary patterns',
          data: new Uint8Array(16384).map((_, i) => (i % 256))
        },
        {
          name: 'Mixed content',
          data: new TextEncoder().encode(
            'Text content '.repeat(500) + 
            'JSON: {"key": "value"} '.repeat(200) + 
            Array.from({ length: 100 }, (_, i) => String.fromCharCode(65 + (i % 26))).join('')
          )
        }
      ]

      dataSets.forEach(dataSet => {
        console.log(`\n📊 Testing ${dataSet.name} (${formatSize(dataSet.data.length)})`)
        
        const result = zstd.compress(dataSet.data, { level: 3 })
        const decompressed = zstd.decompress(result.compressed)
        
        console.log(`   Ratio: ${result.compressionRatio.toFixed(2)}:1, Speed: ${formatSpeed(result.compressionSpeed)}`)
        
        expect(result.compressionRatio).toBeGreaterThan(1)
        expect(decompressed.decompressed.length).toBe(dataSet.data.length)
        expect(decompressed.isValid).toBe(true)
      })
    })
  })

  describe('Performance Metrics', () => {
    test('should track performance correctly', () => {
      const initialMetrics = zstd.getPerformanceMetrics()
      const initialOps = initialMetrics.compressionOps
      
      // Perform compression operations
      const testData = new TextEncoder().encode('Metrics tracking test data for zstd')
      zstd.compress(testData, { level: 3 })
      zstd.compress(testData, { level: 9 })
      
      const updatedMetrics = zstd.getPerformanceMetrics()
      expect(updatedMetrics.compressionOps).toBe(initialOps + 2)
      expect(updatedMetrics.averageCompressionSpeed).toBeGreaterThan(0)
    })

    test('should reset metrics correctly', () => {
      // Perform operations
      const testData = new TextEncoder().encode('Reset test data for zstd')
      zstd.compress(testData)
      
      // Reset and verify
      zstd.resetMetrics()
      const metrics = zstd.getPerformanceMetrics()
      expect(metrics.compressionOps).toBe(0)
      expect(metrics.decompressionOps).toBe(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle empty input', () => {
      const emptyData = new Uint8Array(0)
      expect(() => zstd.compress(emptyData)).toThrow('Input data cannot be empty')
    })

    test('should handle invalid compressed data', () => {
      const invalidData = new Uint8Array([1, 2, 3, 4, 5])
      expect(() => zstd.decompress(invalidData)).toThrow('Decompression failed')
    })

    test('should calculate compression bounds', () => {
      const sizes = [100, 1000, 10000, 100000]
      
      sizes.forEach(size => {
        const bound = zstd.getCompressBound(size)
        expect(bound).toBeGreaterThan(size)
        expect(bound).toBeLessThan(size * 2) // Zstd has reasonable overhead
      })
    })
  })

  describe('Content Hash Verification', () => {
    test('should generate consistent content hashes', () => {
      const testCases = [
        'Hello, Zstd World!',
        'Zstandard compression algorithm test',
        '12345'.repeat(100)
      ]

      testCases.forEach(text => {
        const data = new TextEncoder().encode(text)
        const hash1 = zstd.calculateHash(data)
        const hash2 = zstd.calculateHash(data)
        
        expect(hash1).toBe(hash2) // Deterministic
        expect(typeof hash1).toBe('number')
        expect(hash1).toBeGreaterThanOrEqual(0) // Unsigned 32-bit
      })
    })
  })
})

describe('Utility Functions', () => {
  describe('formatSpeed', () => {
    test('should format speeds correctly', () => {
      expect(formatSpeed(0.5)).toBe('512 B/s')
      expect(formatSpeed(100)).toBe('100.0 KB/s')
      expect(formatSpeed(2048)).toBe('2.0 MB/s')
      expect(formatSpeed(1048576)).toBe('1.0 GB/s')
    })
  })

  describe('formatSize', () => {
    test('should format sizes correctly', () => {
      expect(formatSize(512)).toBe('512 B')
      expect(formatSize(2048)).toBe('2.0 KB')
      expect(formatSize(2097152)).toBe('2.0 MB')
      expect(formatSize(1073741824)).toBe('1.0 GB')
    })
  })
})

// Zstd-specific features are tested in the integration tests