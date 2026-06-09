/**
 * 图片压缩工具
 * 使用 canvas 将图片压缩到指定尺寸和质量
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  mimeType: 'image/jpeg',
};

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns 压缩后的 File 对象
 */
export function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // 计算缩放后的尺寸
      let { width, height } = img;
      const { maxWidth, maxHeight } = opts;

      if (maxWidth && width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (maxHeight && height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      // 创建 canvas 并绘制
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建 canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // 导出为 blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'));
            return;
          }
          // 保持原始文件名，但扩展名改为 jpg
          const originalName = file.name;
          const nameWithoutExt = originalName.replace(/\.[^.]+$/, '');
          const newFileName = `${nameWithoutExt}.jpg`;

          const compressedFile = new File([blob], newFileName, {
            type: opts.mimeType || 'image/jpeg',
            lastModified: Date.now(),
          });

          console.log(`[ImageCompress] ${originalName}: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB`);
          resolve(compressedFile);
        },
        opts.mimeType || 'image/jpeg',
        opts.quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

/**
 * 判断是否为大图（需要压缩）
 * @param file 文件
 * @param thresholdKB 阈值（KB）
 */
export function isLargeImage(file: File, thresholdKB: number = 500): boolean {
  return file.size > thresholdKB * 1024;
}
