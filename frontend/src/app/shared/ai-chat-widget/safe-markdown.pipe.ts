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
    return document.body.innerHTML;
  }
}
