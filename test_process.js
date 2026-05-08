const FILE_BASE_URL = 'http://localhost:8081';
function processRichText(html) {
  if (!html) return '';
  return html.replace(/<img([^>]*?)>/gi, function(match, attrs) {
    let newAttrs = attrs;
    const srcMatch = newAttrs.match(/src\s*=\s*["']?([^"'>\s]+)["']?/i);
    if (srcMatch) {
      const src = srcMatch[1];
      if (src && !src.startsWith('http')) {
        const fullSrc = FILE_BASE_URL + (src.startsWith('/') ? '' : '/') + src;
        newAttrs = newAttrs.replace(srcMatch[0], 'src="' + fullSrc + '"');
      }
    }
    newAttrs = newAttrs
      .replace(/\s+width\s*=\s*["']?[^"'>\s]*["']?/gi, '')
      .replace(/\s+height\s*=\s*["']?[^"'>\s]*["']?/gi, '');
    const styleMatch = newAttrs.match(/style\s*=\s*"([^"]*)"/i);
    if (styleMatch) {
      let styleValue = styleMatch[1]
        .replace(/\bwidth\s*:\s*[^;]+;?/gi, '')
        .replace(/\bheight\s*:\s*[^;]+;?/gi, '')
        .replace(/;+/g, ';')
        .replace(/^;|;$/g, '');
      newAttrs = newAttrs.replace(/style\s*=\s*"[^"]*"/i, 'style="' + styleValue + ';max-width:100%;height:auto;display:block;"');
    } else {
      newAttrs += ' style="max-width:100%;height:auto;display:block;"';
    }
    return '<img' + newAttrs + '>';
  });
}

const tests = [
  '<p><img src="/api/v1/files/static/images/202605/20260507_111032_7e8f8f2c.png"></p>',
  '<p><img src="/api/v1/files/static/images/202605/20260507_111032_7e8f8f2c.png" style="width:100px"></p>',
  '<p><img src="/api/v1/files/static/images/202605/20260507_111032_7e8f8f2c.png" width="100" height="100"></p>',
  '<p><img src=\'http://example.com/test.jpg\'></p>',
];

tests.forEach((t, i) => {
  console.log('Test ' + i + ':');
  console.log('Input:  ', t);
  console.log('Output: ', processRichText(t));
  console.log('');
});
