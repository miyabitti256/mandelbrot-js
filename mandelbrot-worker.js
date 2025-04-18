// Web Worker内でマンデルブロ集合の計算を行う
self.onmessage = function(e) {
  const { 
    rowStart, rowEnd, width, 
    centerX, centerY, zoom, 
    maxIterations, colors
  } = e.data;
  
  // 複素平面の範囲を計算
  const xMin = centerX - 2.0 / zoom;
  const xMax = centerX + 2.0 / zoom;
  const yMin = centerY - 2.0 / zoom;
  const yMax = centerY + 2.0 / zoom;
  
  const dx = (xMax - xMin) / width;
  const dy = (yMax - yMin) / width;
  
  // 結果を格納する配列
  const resultData = new Uint8ClampedArray((rowEnd - rowStart) * width * 4);
  
  // 割り当てられた行の範囲でマンデルブロ集合を計算
  for (let y = rowStart; y < rowEnd; y++) {
    for (let x = 0; x < width; x++) {
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
      
      // ピクセルの色を決定
      const pixelIndex = ((y - rowStart) * width + x) * 4;
      
      if (iteration === maxIterations) {
        // 集合内部は黒
        resultData[pixelIndex] = 0;
        resultData[pixelIndex + 1] = 0;
        resultData[pixelIndex + 2] = 0;
      } else {
        // 外部は繰り返し回数に基づいた色
        const colorIndex = iteration % colors.length;
        const color = colors[colorIndex];
        
        // 色を設定
        resultData[pixelIndex] = color[0];     // R
        resultData[pixelIndex + 1] = color[1]; // G
        resultData[pixelIndex + 2] = color[2]; // B
      }
      resultData[pixelIndex + 3] = 255; // アルファ値（透明度）
    }
  }
  
  // 結果をメインスレッドに送信
  self.postMessage({
    rowStart,
    rowEnd,
    resultData
  }, [resultData.buffer]);
}; 