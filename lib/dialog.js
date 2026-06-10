/*
 * Minimal confirm/notice dialogs per design.md §5.16.
 * Surfaces that import this must include the .dlg-* styles in their CSS
 * (popup.css / options.css) and define the .btn / .btn.primary / .btn.ghost
 * button classes the dialog reuses.
 */

const ICON_WARN = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.5L1.5 14h13L8 1.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6v3M8 11.5v.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const ICON_INFO = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.5V11M8 4.5v.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

export function confirmDialog({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return open({ title, body, confirmLabel, cancelLabel, danger, withCancel: true });
}

export function noticeDialog({ title, body, confirmLabel = 'OK', danger = false }) {
  return open({ title, body, confirmLabel, danger, withCancel: false });
}

function open({ title, body, confirmLabel, cancelLabel, danger, withCancel }) {
  return new Promise(resolve => {
    const prevFocus = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'dlg-backdrop';
    backdrop.innerHTML = `
      <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body">
        <div class="dlg-head">
          <span class="dlg-mark${danger ? ' danger' : ''}" aria-hidden="true">${danger ? ICON_WARN : ICON_INFO}</span>
          <span class="dlg-title" id="dlg-title"></span>
        </div>
        <p class="dlg-body" id="dlg-body"></p>
        <div class="dlg-actions">
          ${withCancel ? '<button type="button" class="btn ghost" data-act="cancel"></button>' : ''}
          <button type="button" class="btn primary${danger ? ' danger' : ''}" data-act="confirm"></button>
        </div>
      </div>`;
    backdrop.querySelector('.dlg-title').textContent = title;
    backdrop.querySelector('.dlg-body').textContent = body;
    const confirmBtn = backdrop.querySelector('[data-act="confirm"]');
    confirmBtn.textContent = confirmLabel;
    const cancelBtn = backdrop.querySelector('[data-act="cancel"]');
    if (cancelBtn) cancelBtn.textContent = cancelLabel;

    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
      resolve(result);
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(false);
      } else if (e.key === 'Tab') {
        const focusables = [cancelBtn, confirmBtn].filter(Boolean);
        e.preventDefault();
        if (focusables.length < 2) { focusables[0].focus(); return; }
        const idx = focusables.indexOf(document.activeElement);
        const next = e.shiftKey
          ? (idx <= 0 ? focusables.length - 1 : idx - 1)
          : (idx >= focusables.length - 1 ? 0 : idx + 1);
        focusables[next].focus();
      }
    }

    confirmBtn.addEventListener('click', () => close(true));
    if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);
    // Destructive confirms default focus to the safe action.
    (danger && cancelBtn ? cancelBtn : confirmBtn).focus();
  });
}
