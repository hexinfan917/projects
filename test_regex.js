const html = '<p><img src="/api/v1/files/static/images/202605/20260507_111032_7e8f8f2c.png"></p>';
const matches = html.match(/<img([^>]*?)>/gi);
console.log('matches:', matches);
const srcMatch = matches[0].match(/src\s*=\s*["']?([^"'>\s]+)["']?/i);
console.log('srcMatch:', srcMatch);

// Simulate the compiled function
const FILE_BASE_URL = 'http://localhost:8081';
function p(e) {
  return e ? e.replace(/<img([^>]*?)>/gi, function(e, s) {
    var a = s, c = a.match(/src\s*=\s*["']?([^"'>\s]+)["']?/i);
    if (c) {
      var t = c[1];
      if (t && !t.startsWith('http')) {
        var n = ''.concat(FILE_BASE_URL).concat(t.startsWith('/') ? '' : '/').concat(t);
        a = a.replace(c[0], 'src="'.concat(n, '"'));
      }
    }
    a = a.replace(/\s+width\s*=\s*["']?[^"'>\s]*["']?/gi, '').replace(/\s+height\s*=\s*["']?[^"'>\s]*["']?/gi, '');
    var l = a.match(/style\s*=\s*"([^"]*)"/i);
    if (l) {
      var r = l[1].replace(/\bwidth\s*:\s*[^;]+;?/gi, '').replace(/\bheight\s*:\s*[^;]+;?/gi, '').replace(/;+/g, ';').replace(/^;|;$/g, '');
      a = a.replace(/style\s*=\s*"[^"]*"/i, 'style="'.concat(r, ';max-width:100%;height:auto;display:block;"'));
    } else {
      a += ' style="max-width:100%;height:auto;display:block;"';
    }
    return '<img'.concat(a, '>');
  }) : '';
}

console.log('Processed:', p(html));
