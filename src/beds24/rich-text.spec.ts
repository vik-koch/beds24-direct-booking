import { richText } from './rich-text';

describe('richText', () => {
  it('is empty for a text left empty', () => {
    expect(richText('<p><br></p>')).toBe('');
    expect(richText('')).toBe('');
  });

  it('keeps paragraphs, lists, quotes, rules, sup and sub', () => {
    const html =
      '<p>a<br>b</p><ul><li>c</li></ul><ol><li>d</li></ol><blockquote>e</blockquote><hr><p>m<sup>2</sup> H<sub>2</sub>O</p>';
    expect(richText(html)).toBe(
      '<p>a<br />b</p><ul><li>c</li></ul><ol><li>d</li></ol><blockquote>e</blockquote><hr /><p>m<sup>2</sup> H<sub>2</sub>O</p>',
    );
  });

  it('turns bold and italic, as tags or styled spans, into strong and em', () => {
    expect(
      richText(
        '<p><b>a</b> <span style="font-weight: bolder;">b</span> <i>c</i> <span style="font-style: italic">d</span></p>',
      ),
    ).toBe('<p><strong>a</strong> <strong>b</strong> <em>c</em> <em>d</em></p>');
  });

  it('makes every heading one level, and repairs a heading inside a paragraph', () => {
    expect(richText('<p><h1 class="">A</h1><p class="">b</p></p><h4>C</h4>')).toBe(
      '<h3>A</h3><p>b</p><h3>C</h3>',
    );
  });

  it('unwraps spans, fonts, underlines, strikes, pre and tables', () => {
    expect(
      richText(
        '<p><span style="font-family: sans-serif">a</span> <font color="#104a5a" face="sans-serif">b</font> <u>c</u> <strike>d</strike></p><pre>e</pre>',
      ),
    ).toBe('<p>a b c d</p>e');
    expect(
      richText(
        '<table class="table table-bordered"><tbody><tr><td style="padding: 8px">Unten</td><td>Bad</td></tr></tbody></table>',
      ),
    ).toBe('<p>Unten – Bad</p>');
  });

  it('drops pictures, video, frames, scripts and styles with their content', () => {
    expect(
      richText(
        '<p>a<img src="https://beds24.test/1.png" width="300"><video src="v"></video><iframe src="f"></iframe><script>x()</script><style>p{}</style></p>',
      ),
    ).toBe('<p>a</p>');
  });

  it('keeps links to web, mail and phone without a target, and unwraps the rest', () => {
    expect(
      richText(
        '<p><a href="http://a.test" target="_blank">a</a> <a href="mailto:b@c.test">b</a> <a href="tel:+43">c</a> <a href="javascript:alert(1)">d</a> <a href="//e.test">e</a></p>',
      ),
    ).toBe(
      '<p><a href="http://a.test">a</a> <a href="mailto:b@c.test">b</a> <a href="tel:+43">c</a> d e</p>',
    );
  });

  it('strips styles, classes, U+FEFF, empty paragraphs and empty links', () => {
    expect(
      richText(
        '<p class="" style="line-height: 1.5;">﻿a<br></p><p> </p><p><a href="https://a.test"><br></a></p>',
      ),
    ).toBe('<p>a</p>');
  });
});
