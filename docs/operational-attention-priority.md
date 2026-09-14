# Canonical Operational Attention priority

The existing business wording and active-data bindings are retained. The shared AttentionSummaryComponent maps zero items to a hidden neutral state; active INFO/ATTENTION and unknown future types to notice; HIGH to high attention; and CRITICAL to critical attention. Critical takes precedence over high. No text inference, alert-type CSS or demo values are used.

The card has an attention icon, a stronger side accent, a count badge, compact labeled severity indicators, a static subtle glow and a clear CTA. Critical uses stronger amber emphasis; high uses a quieter gold accent. It is an operational priority treatment, not an API error panel. Historical/resolved/acknowledged alerts are excluded by the existing active selectors.

Dark and light palettes have separate foreground/accent values. Icon, wording, counts and labels accompany color; keyboard focus is explicit. The duplicated visual badge is hidden from assistive technology because the sentence already exposes the count. No flashing or motion is introduced; reduced motion and forced colors are respected.

Tests cover zero, notice, high, critical, critical+high, actual badge counts, future fallback, both themes, live severity reduction and resolved-item exclusion. Integrated frontend 259/259 and isolated frontend 250/250 tests passed, with typechecks and production builds. Existing unrelated bundle/style budget warnings remain.

Browser validation on localhost:4300 confirmed the real approval result, decision basis, and reduction to four active items/two high items after the pending critical approval was approved through the user interface. The canonical card gained the intended visible border, badge, icon and CTA emphasis. The same component is used in normal YvY and Turing Demo.

A subsequent real rehearsal request restored five active items, one critical and two high. The critical card was visually checked in both dark and light mode, with readable text, badge, labeled severity dots and no flashing. Review approval and View decision basis were exercised without clicking Approve or Reject. Dark mode was restored. The new rehearsal approval remains pending.
