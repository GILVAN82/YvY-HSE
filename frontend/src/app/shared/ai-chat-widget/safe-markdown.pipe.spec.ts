import { SafeMarkdownPipe } from './safe-markdown.pipe';
import { TestBed } from '@angular/core/testing';

describe('SafeMarkdownPipe', () => {
  let pipe: SafeMarkdownPipe;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SafeMarkdownPipe] });
    pipe = TestBed.runInInjectionContext(() => new SafeMarkdownPipe());
  });
  afterEach(() => TestBed.resetTestingModule());
  const render = (markdown: string) => {
    const host = document.createElement('div');
    host.innerHTML = pipe.transform(markdown);
    return host;
  };

  it('renders standard formatting without exposing raw Markdown markers', () => {
    const host = render('## Risk Level\n\n**High** and *controlled*\n\n1. Isolate\n2. Verify\n\n- Lock\n- Tag');
    expect(host.querySelector('h2')?.textContent).toBe('Risk Level');
    expect(host.querySelector('strong')?.textContent).toBe('High');
    expect(host.querySelector('em')?.textContent).toBe('controlled');
    expect(host.querySelectorAll('ol li').length).toBe(2);
    expect(host.querySelectorAll('ul li').length).toBe(2);
    expect(host.textContent).not.toContain('**');
  });

  it('renders code, blockquotes and line breaks', () => {
    const host = render('> Verify isolation\n\nUse `LOTO`.\n\n```text\nzero energy\n```\nfirst line\nsecond line');
    expect(host.querySelector('blockquote')?.textContent).toContain('Verify isolation');
    expect(host.querySelector('p code')?.textContent).toBe('LOTO');
    expect(host.querySelector('pre code')?.textContent).toContain('zero energy');
    expect(host.querySelectorAll('br').length).toBeGreaterThan(0);
  });

  it('handles incomplete streamed Markdown and renders the completed form', () => {
    expect(() => pipe.transform('**Risk')).not.toThrow();
    expect(render('**Risk:** High').querySelector('strong')?.textContent).toBe('Risk:');
  });

  it('escapes raw HTML and removes executable payloads', () => {
    const host = render('<script>alert(1)</script>\n<img src=x onerror=alert(2)>');
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<script>alert(1)</script>');
  });

  it('rejects javascript URLs and secures normal links', () => {
    const unsafe = render('[unsafe](javascript:alert(1))');
    expect(unsafe.querySelector('a')?.getAttribute('href')).toBeNull();
    const safe = render('[OSHA](https://www.osha.gov/)');
    expect(safe.querySelector('a')?.getAttribute('href')).toBe('https://www.osha.gov/');
    expect(safe.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('keeps short data columns intact and wraps long descriptions in a keyboard-accessible table', () => {
    const host = render('| ID | Priority | Status | Due date | Action |\n| --- | --- | --- | --- | --- |\n| DEMO-0001 | Critical | In Progress | 2026-06-23 | Example description that should wrap across lines without compressing identifiers. |');
    const region = host.querySelector('.markdown-table-scroll');
    expect(region?.getAttribute('tabindex')).toBe('0');
    expect(region?.getAttribute('role')).toBe('region');
    expect(region?.querySelectorAll('table').length).toBe(1);
    const cells = host.querySelectorAll('tbody td');
    expect(cells[0].classList.contains('markdown-compact-cell')).toBeTrue();
    expect(cells[3].textContent).toBe('2026-06-23');
    expect(cells[3].classList.contains('markdown-compact-cell')).toBeTrue();
    expect(cells[4].classList.contains('markdown-text-cell')).toBeTrue();
    expect(host.querySelector('th')?.getAttribute('scope')).toBe('col');
  });

});
