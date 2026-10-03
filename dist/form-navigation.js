// Keep native choice controls and text editing intact; move only at text boundaries.
export function arrowDirection(event, input) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return 0;
  if (input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') return 0;
  if (input.tagName === 'INPUT' && !['text','number'].includes(input.type)) return 0;
  // A datalist needs Up/Down for its native suggestion popup.
  if (input.hasAttribute('list') && ['ArrowUp','ArrowDown'].includes(event.key)) return 0;
  const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
  const start = input.selectionStart, end = input.selectionEnd;
  if (start !== null && start !== undefined) {
    if (start !== end) return 0;
    if (back ? start !== 0 : end !== input.value.length) return 0;
  }
  return back ? -1 : 1;
}

export function navigatePOForm(event) {
  const input = event.target, form = input.closest?.('#po-form');
  if (!form) return;
  const direction = arrowDirection(event,input);
  if (!direction) return;
  const fields = [...form.querySelectorAll('input,textarea,select')].filter(field =>
    !field.disabled && !field.readOnly && field.type !== 'hidden' && !field.closest('[hidden]') &&
    (field.type !== 'radio' || field.checked || !form.querySelector(`input[name="${field.name}"]:checked`) && field === form.querySelector(`input[name="${field.name}"]`)));
  const index = fields.indexOf(input), next = index >= 0 ? fields[index + direction] : null;
  if (!next) return;
  event.preventDefault();
  next.focus();
}
