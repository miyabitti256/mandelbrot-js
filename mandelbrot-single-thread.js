document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const zoomDisplay = document.getElementById('zoom');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const iterationInput = document.getElementById('iteration');
  const resetBtn = document.getElementById('reset');
  const renderTimeDisplay = document.getElementById('render-time');

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

  // マンデルブロ集合の描画関数
  function drawMandelbrot() {
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
    if (maxIterations < 10) maxIterations = 10;
    if (maxIterations > 100000) maxIterations = 100000;
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

  // 初期描画
  drawMandelbrot();
});