document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const zoomDisplay = document.getElementById('zoom');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const iterationInput = document.getElementById('iteration');
  const resetBtn = document.getElementById('reset');
  const renderTimeDisplay = document.getElementById('render-time');
  const coreCountDisplay = document.getElementById('core-count');
  const parallelModeCheckbox = document.getElementById('parallel-mode');

  // キャンバスサイズの設定
  canvas.width = 600;
  canvas.height = 600;

  // マンデルブロ集合のパラメータ
  let centerX = -0.5;
  let centerY = 0;
  let zoom = 1;
  let maxIterations = parseInt(iterationInput.value);
  
  // レンダリング計測用
  let renderStartTime = 0;
  
  // 色の設定
  const colors = [];
  for (let i = 0; i < 256; i++) {
    // HSL形式の色を直接RGBの配列に変換して保存
    const hue = i;
    const r = convertHSLtoRGB(hue, 100, 50)[0];
    const g = convertHSLtoRGB(hue, 100, 50)[1];
    const b = convertHSLtoRGB(hue, 100, 50)[2];
    colors.push([r, g, b]);
  }
  
  // HSLからRGBへの変換関数
  function convertHSLtoRGB(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // Web Worker関連の変数
  const workerCount = navigator.hardwareConcurrency || 4; // 利用可能なコア数
  let workers = [];
  let pendingWorkers = 0; // 処理中のWorker数
  let imageData = null;

  // コア数表示を更新
  coreCountDisplay.textContent = parallelModeCheckbox.checked ? workerCount : 1;

  // 並列モード切り替え
  parallelModeCheckbox.addEventListener('change', () => {
    const isParallel = parallelModeCheckbox.checked;
    coreCountDisplay.textContent = isParallel ? workerCount : 1;
    
    if (isParallel && workers.length === 0) {
      initWorkers();
    }
    
    drawMandelbrot();
  });

  // Workerの初期化
  function initWorkers() {
    // 既存のWorkerを終了
    workers.forEach(worker => worker.terminate());
    workers = [];
    
    // 新しいWorkerを作成
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker('mandelbrot-worker.js');
      
      worker.onmessage = function(e) {
        const { rowStart, rowEnd, resultData } = e.data;
        
        // 受け取ったデータをキャンバスのimageDataに書き込む
        const uint8Data = new Uint8ClampedArray(resultData);
        for (let y = rowStart; y < rowEnd; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const srcIdx = ((y - rowStart) * canvas.width + x) * 4;
            const destIdx = (y * canvas.width + x) * 4;
            imageData.data[destIdx] = uint8Data[srcIdx];
            imageData.data[destIdx + 1] = uint8Data[srcIdx + 1];
            imageData.data[destIdx + 2] = uint8Data[srcIdx + 2];
            imageData.data[destIdx + 3] = uint8Data[srcIdx + 3];
          }
        }
        
        // 全てのWorkerの処理が終わったらキャンバスに描画
        pendingWorkers--;
        if (pendingWorkers === 0) {
          ctx.putImageData(imageData, 0, 0);
          
          // レンダリング時間を計算して表示
          const renderTime = performance.now() - renderStartTime;
          renderTimeDisplay.textContent = renderTime.toFixed(1);
        }
      };
      
      workers.push(worker);
    }
  }

  // 単一スレッドでのマンデルブロ集合描画
  function drawMandelbrotSingleThread() {
    // レンダリング開始時間を記録
    renderStartTime = performance.now();
    
    // 新しいimageDataを作成
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    
    // 複素平面の範囲を計算
    const xMin = centerX - 2.0 / zoom;
    const xMax = centerX + 2.0 / zoom;
    const yMin = centerY - 2.0 / zoom;
    const yMax = centerY + 2.0 / zoom;
    
    const dx = (xMax - xMin) / canvas.width;
    const dy = (yMax - yMin) / canvas.height;
    
    // 各ピクセルでマンデルブロ集合の計算を行う
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const cReal = xMin + x * dx;
        const cImag = yMin + y * dy;
        
        let zReal = 0;
        let zImag = 0;
        let iteration = 0;
        
        // z = z^2 + c の漸化式を計算
        while (zReal * zReal + zImag * zImag < 4 && iteration < maxIterations) {
          const zRealTemp = zReal * zReal - zImag * zImag + cReal;
          zImag = 2 * zReal * zImag + cImag;
          zReal = zRealTemp;
          iteration++;
        }
        
        // 結果に基づいて色を設定
        const pixelIndex = (y * canvas.width + x) * 4;
        
        if (iteration === maxIterations) {
          // 集合内部は黒
          data[pixelIndex] = 0;
          data[pixelIndex + 1] = 0;
          data[pixelIndex + 2] = 0;
        } else {
          // 外部は繰り返し回数に基づいた色
          const colorIndex = iteration % colors.length;
          const color = colors[colorIndex];
          data[pixelIndex] = color[0];     // R
          data[pixelIndex + 1] = color[1]; // G
          data[pixelIndex + 2] = color[2]; // B
        }
        data[pixelIndex + 3] = 255; // アルファ値（透明度）
      }
    }
    
    // キャンバスに描画
    ctx.putImageData(imageData, 0, 0);
    
    // レンダリング時間を計算して表示
    const renderTime = performance.now() - renderStartTime;
    renderTimeDisplay.textContent = renderTime.toFixed(1);
    
    // ズーム表示を更新
    zoomDisplay.textContent = zoom.toFixed(1);
  }

  // マンデルブロ集合の描画関数（並列版）
  function drawMandelbrotParallel() {
    // レンダリング開始時間を記録
    renderStartTime = performance.now();
    
    // 処理中のWorker数をリセット
    pendingWorkers = workerCount;
    
    // 新しいimageDataを作成
    imageData = ctx.createImageData(canvas.width, canvas.height);
    
    // Workerに仕事を割り当て
    const rowsPerWorker = Math.ceil(canvas.height / workerCount);
    
    workers.forEach((worker, index) => {
      const rowStart = index * rowsPerWorker;
      const rowEnd = Math.min(rowStart + rowsPerWorker, canvas.height);
      
      worker.postMessage({
        rowStart,
        rowEnd,
        width: canvas.width,
        centerX,
        centerY,
        zoom,
        maxIterations,
        colors
      });
    });
    
    // ズーム表示を更新
    zoomDisplay.textContent = zoom.toFixed(1);
  }

  // モードに応じたマンデルブロ集合描画関数
  function drawMandelbrot() {
    if (parallelModeCheckbox.checked) {
      drawMandelbrotParallel();
    } else {
      drawMandelbrotSingleThread();
    }
  }

  // ズームイン
  zoomInBtn.addEventListener('click', () => {
    zoom *= 1.5;
    drawMandelbrot();
  });

  // ズームアウト
  zoomOutBtn.addEventListener('click', () => {
    zoom /= 1.5;
    if (zoom < 0.1) zoom = 0.1;
    drawMandelbrot();
  });

  // 反復回数の変更
  iterationInput.addEventListener('change', () => {
    maxIterations = parseInt(iterationInput.value);
    if (maxIterations < 1) maxIterations = 1;
    if (maxIterations > 1000000) maxIterations = 1000000;
    iterationInput.value = maxIterations;
    drawMandelbrot();
  });

  // リセット
  resetBtn.addEventListener('click', () => {
    centerX = -0.5;
    centerY = 0;
    zoom = 1;
    maxIterations = 100;
    iterationInput.value = maxIterations;
    drawMandelbrot();
  });

  // クリック位置を中心にする機能
  canvas.addEventListener('click', (e) => {
    // クリック位置をキャンバス座標から複素平面座標に変換
    const xMin = centerX - 2.0 / zoom;
    const yMin = centerY - 2.0 / zoom;
    const dx = 4.0 / (zoom * canvas.width);
    const dy = 4.0 / (zoom * canvas.height);
    
    // クリック位置を新しい中心座標に設定
    centerX = xMin + e.offsetX * dx;
    centerY = yMin + e.offsetY * dy;
    
    // 新しい中心座標で再描画
    drawMandelbrot();
  });

  // 初期化とWorkerの準備
  if (parallelModeCheckbox.checked) {
    initWorkers();
  }
  
  // 初期描画
  drawMandelbrot();
});
