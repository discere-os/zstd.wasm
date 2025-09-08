/*
 * Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved.
 * Copyright 2025 Superstruct Ltd, New Zealand
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import WASMModuleInterface from './index.js';

// Ecosystem-compatible loader
export class WASMLoader {
  constructor(basePath = './') {
    this.basePath = basePath;
  }

  async load(variant = 'release') {
    const manifest = await this.loadManifest();
    const selectedVariant = manifest.variants[variant] || manifest.variants.fallback;
    
    // Load WASM and JS files
    const [wasmBytes, jsModule] = await Promise.all([
      fetch(this.basePath + selectedVariant.wasm).then(r => r.arrayBuffer()),
      import(this.basePath + selectedVariant.js)
    ]);

    // Create standard interface
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module, this.getImports());
    
    return new WASMModuleInterface(instance, manifest);
  }

  async loadManifest() {
    const response = await fetch(this.basePath + 'manifest.json');
    return response.json();
  }

  getImports() {
    return {
      env: {
        memory: new WebAssembly.Memory({ initial: 256 }),
        __syscall_openat: () => -1,
        __syscall_read: () => -1,
        __syscall_write: () => -1
      }
    };
  }
}

export default WASMLoader;