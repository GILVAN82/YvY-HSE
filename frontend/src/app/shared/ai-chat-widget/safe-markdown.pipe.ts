import { Pipe, PipeTransform, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';

const renderer = new marked.Renderer();
renderer.html = ({ text }) => text
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

/** Parses assistant Markdown and removes unsafe HTML before Angular renders it. */
@Pipe({ name: 'safeMarkdown', standalone: true, pure: true })
export class SafeMarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(markdown: string): string {
    const parsed = marked.parse(markdown ?? '', { async: false, gfm: true, breaks: true, renderer }) as string;
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, parsed) ?? '';

    // Markdown links stay in the current tab. The relationship attributes also
    // protect users if target behavior is changed by browser or host policy.
    const document = new DOMParser().parseFromString(sanitized, 'text/html');
    for (const link of Array.from(document.querySelectorAll('a'))) {
      if (link.getAttribute('href')?.startsWith('unsafe:')) link.removeAttribute('href');
      link.setAttribute('rel', 'noopener noreferrer');
    }
    for (const table of Array.from(document.querySelectorAll('table'))) {
      const wrapper = document.createElement('div');
      wrapper.className = 'markdown-table-scroll';
      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', 'Data table');
      table.replaceWith(wrapper);
      wrapper.appendChild(table);
      const rows = Array.from(table.rows);
      const columns = Math.max(0, ...rows.map(row => row.cells.length));
      for (let column = 0; column < columns; column++) {
        const cells = rows.map(row => row.cells[column]).filter(Boolean);
        const compact = cells.every(cell => {
          const text = cell.textContent?.trim() ?? '';
          return text.length <= 32 && text.split(/\s+/).length <= 4;
        });
        for (const cell of cells) {
          cell.classList.add(compact ? 'markdown-compact-cell' : 'markdown-text-cell');
          if (cell.tagName === 'TH') cell.setAttribute('scope', 'col');
        }
      }
    }
    return document.body.innerHTML;
  }
}
