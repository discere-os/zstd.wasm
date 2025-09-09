/**
 * Comprehensive benchmarking suite for zstd.wasm
 * Performance validation and algorithm testing
 */

import Zstd, { formatSpeed, formatSize } from './lib/index.js'

interface BenchmarkConfiguration {
  name: string
  dataSize: number
  dataType: 'text' | 'json' | 'binary' | 'random'
  compressionLevels: Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19>
  iterations: number
}

export async function runComprehensiveBenchmark(): Promise<void> {
  console.log('🏁 zstd.wasm Comprehensive Benchmark Suite\n')

  const zstd = new Zstd()
  await zstd.initialize({ enableMetrics: true })
  
  console.log(`📊 Module: ${zstd.getVersion()}`)
  const capabilities = zstd.getSystemCapabilities()
  console.log(`⚡ SIMD: ${capabilities.simdSupported ? 'Enabled' : 'Disabled'}`)
  console.log(`💾 Memory: ${capabilities.estimatedMemory ? capabilities.estimatedMemory + ' GB' : 'Unknown'}`)
  console.log(`🖥️ Cores: ${capabilities.coreCount || 'Unknown'}\n`)

  const configurations: BenchmarkConfiguration[] = [
    {
      name: 'Small Text Data',
      dataSize: 8192, // 8KB
      dataType: 'text',
      compressionLevels: [1, 3, 9, 19],
      iterations: 10
    },
    {
      name: 'Medium JSON Data',
      dataSize: 65536, // 64KB
      dataType: 'json', 
      compressionLevels: [1, 3, 9, 19],
      iterations: 5
    },
    {
      name: 'Large Text Document',
      dataSize: 1048576, // 1MB
      dataType: 'text',
      compressionLevels: [3, 9, 19],
      iterations: 3
    },
    {
      name: 'Binary Pattern Data',
      dataSize: 262144, // 256KB
      dataType: 'binary',
      compressionLevels: [1, 3, 9],
      iterations: 5
    },
    {
      name: 'Random Data (Worst Case)',
      dataSize: 32768, // 32KB
      dataType: 'random',
      compressionLevels: [1, 3, 9],
      iterations: 5
    }
  ]

  const allResults: Array<{
    config: BenchmarkConfiguration
    results: any
    averageSpeed: number
    bestRatio: number
  }> = []

  for (const config of configurations) {
    console.log(`🧪 Testing: ${config.name}`)
    console.log(`   Size: ${formatSize(config.dataSize)}, Type: ${config.dataType}`)
    console.log(`   Compression levels: [${config.compressionLevels.join(', ')}], Iterations: ${config.iterations}`)

    const testData = generateTestData(config.dataSize, config.dataType)
    const results: Record<number, {
      compressionSpeed: number
      decompressionSpeed: number
      compressionRatio: number
      spaceSaved: number
      avgTime: number
      validated: boolean
    }> = {}

    for (const level of config.compressionLevels) {
      const runs: Array<{
        compressionSpeed: number
        decompressionSpeed: number
        compressionRatio: number
        compressionTime: number
        decompressionTime: number
        validated: boolean
      }> = []

      console.log(`\n   Level ${level}:`)

      // Warm up run
      const warmup = zstd.compress(testData, { level })
      zstd.decompress(warmup.compressed)

      // Benchmark runs
      for (let i = 0; i < config.iterations; i++) {
        const compResult = zstd.compress(testData, { level })
        const decompResult = zstd.decompress(compResult.compressed)
        
        // Validate byte-for-byte accuracy
        let isValid = decompResult.decompressed.length === testData.length
        if (isValid && testData.length < 100000) { // Full validation for smaller data
          for (let j = 0; j < testData.length; j++) {
            if (testData[j] !== decompResult.decompressed[j]) {
              isValid = false
              break
            }
          }
        }

        runs.push({
          compressionSpeed: compResult.compressionSpeed,
          decompressionSpeed: decompResult.decompressionSpeed,
          compressionRatio: compResult.compressionRatio,
          compressionTime: compResult.compressionTime,
          decompressionTime: decompResult.decompressionTime,
          validated: isValid
        })

        if (!isValid) {
          console.log(`     ❌ Run ${i + 1}: Validation FAILED`)
        }
      }

      // Calculate averages
      const avgCompSpeed = runs.reduce((sum, r) => sum + r.compressionSpeed, 0) / runs.length
      const avgDecompSpeed = runs.reduce((sum, r) => sum + r.decompressionSpeed, 0) / runs.length
      const avgCompRatio = runs.reduce((sum, r) => sum + r.compressionRatio, 0) / runs.length
      const avgSpaceSaved = runs.reduce((sum, r) => sum + (1 - 1/r.compressionRatio) * 100, 0) / runs.length
      const avgTotalTime = runs.reduce((sum, r) => sum + r.compressionTime + r.decompressionTime, 0) / runs.length
      const allValidated = runs.every(r => r.validated)

      results[level] = {
        compressionSpeed: avgCompSpeed,
        decompressionSpeed: avgDecompSpeed, 
        compressionRatio: avgCompRatio,
        spaceSaved: avgSpaceSaved,
        avgTime: avgTotalTime,
        validated: allValidated
      }

      console.log(`     Avg: ${formatSpeed(avgCompSpeed)} comp, ${formatSpeed(avgDecompSpeed)} decomp`)
      console.log(`     Ratio: ${avgCompRatio.toFixed(2)}:1 (${avgSpaceSaved.toFixed(1)}% saved)`)
      console.log(`     Validation: ${allValidated ? 'ALL PASSED ✅' : 'SOME FAILED ❌'}`)
    }

    const bestSpeedLevel = Object.entries(results).reduce((a, b) => 
      results[parseInt(a[0])]!.compressionSpeed > results[parseInt(b[0])]!.compressionSpeed ? a : b
    )
    const bestRatioLevel = Object.entries(results).reduce((a, b) => 
      results[parseInt(a[0])]!.compressionRatio > results[parseInt(b[0])]!.compressionRatio ? a : b  
    )

    console.log(`\n   🏆 Results Summary:`)
    console.log(`   • Fastest: Level ${bestSpeedLevel[0]} (${formatSpeed(bestSpeedLevel[1]!.compressionSpeed)})`)
    console.log(`   • Best ratio: Level ${bestRatioLevel[0]} (${bestRatioLevel[1]!.compressionRatio.toFixed(2)}:1)`)
    
    allResults.push({
      config,
      results,
      averageSpeed: Object.values(results).reduce((sum, r) => sum + r.compressionSpeed, 0) / Object.keys(results).length,
      bestRatio: Math.max(...Object.values(results).map(r => r.compressionRatio))
    })

    console.log('') // Spacing
  }

  // Overall Summary
  console.log('🏆 OVERALL BENCHMARK SUMMARY')
  console.log('=' .repeat(50))

  const overallAvgSpeed = allResults.reduce((sum, r) => sum + r.averageSpeed, 0) / allResults.length
  const overallBestRatio = Math.max(...allResults.map(r => r.bestRatio))
  
  console.log(`📈 Average compression speed: ${formatSpeed(overallAvgSpeed)}`)
  console.log(`🎯 Best compression ratio: ${overallBestRatio.toFixed(2)}:1`)
  
  // Performance by data type
  console.log('\n📊 Performance by Data Type:')
  allResults.forEach(result => {
    console.log(`   ${result.config.name}: ${formatSpeed(result.averageSpeed)} avg, ${result.bestRatio.toFixed(2)}:1 best ratio`)
  })

  // Performance Target Analysis  
  console.log('\n🎖️ Performance Analysis:')
  const compTargetKBps = 100 * 1024 // 100 MB/s target for zstd (very fast)
  const decompTargetKBps = 500 * 1024 // 500 MB/s target for zstd decompression
  
  console.log(`   Compression performance: ${formatSpeed(overallAvgSpeed)} ${overallAvgSpeed >= compTargetKBps ? '✅ Excellent' : '⚠️ Good'}`)
  
  const finalMetrics = zstd.getPerformanceMetrics()
  console.log(`   Decompression performance: ${formatSpeed(finalMetrics.averageDecompressionSpeed)} ${finalMetrics.averageDecompressionSpeed >= decompTargetKBps ? '✅ Excellent' : '⚠️ Good'}`)

  console.log('\n✨ Comprehensive benchmark completed successfully!')
  
  zstd.cleanup()
}

function generateTestData(size: number, type: 'text' | 'json' | 'binary' | 'random'): Uint8Array {
  const data = new Uint8Array(size)
  
  switch (type) {
    case 'text': {
      const pattern = 'Zstandard (zstd) is a fast compression algorithm, providing high compression ratios. It is developed by Facebook and offers a good balance between compression ratio and speed. '
      const patternBytes = new TextEncoder().encode(pattern)
      for (let i = 0; i < size; i++) {
        data[i] = patternBytes[i % patternBytes.length]!
      }
      break
    }
    case 'json': {
      const jsonObj = {
        algorithm: 'zstd',
        metadata: { version: '1.5.6', timestamp: Date.now() },
        config: { level: 3, fast_mode: true, long_range: false },
        data: Array.from({ length: Math.floor(size / 300) }, (_, i) => ({
          id: `zstd_${i.toString().padStart(5, '0')}`,
          value: Math.sin(i * 0.1) * 100,
          category: ['compression', 'decompression', 'dictionary'][i % 3],
          active: i % 2 === 0
        }))
      }
      const jsonStr = JSON.stringify(jsonObj).slice(0, size)
      const jsonBytes = new TextEncoder().encode(jsonStr)
      jsonBytes.forEach((byte, i) => { if (i < size) data[i] = byte })
      break
    }
    case 'binary':
      for (let i = 0; i < size; i++) {
        // Create patterns that zstd can exploit well
        if (i % 512 < 128) {
          data[i] = 0x5A // 'Z' pattern blocks
        } else if (i % 512 < 256) {
          data[i] = i % 256 // Sequential pattern
        } else {
          data[i] = (i * 13) % 256 // Mathematical pattern
        }
      }
      break
    case 'random':
      for (let i = 0; i < size; i++) {
        data[i] = Math.floor(Math.random() * 256)
      }
      break
  }
  
  return data
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveBenchmark().catch(console.error)
}