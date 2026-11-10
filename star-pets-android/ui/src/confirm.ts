export function confirmClear(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'clear-confirm';
    const title = document.createElement('h2');
    title.textContent = '请确认';
    const p = document.createElement('p');
    p.textContent = message;
    const footer = document.createElement('footer'),
      cancel = document.createElement('button'),
      yes = document.createElement('button');
    cancel.type = yes.type = 'button';
    cancel.textContent = '取消';
    yes.textContent = '继续';
    yes.className = 'primary';
    let settled = false;
    function done(value: boolean) {
      if (settled) return;
      settled = true;
      d.close();
      d.remove();
      resolve(value);
    }
    cancel.onclick = () => done(false);
    yes.onclick = () => done(true);
    d.addEventListener('cancel', (e) => {
      e.preventDefault();
      done(false);
    });
    footer.append(cancel, yes);
    d.append(title, p, footer);
    document.body.append(d);
    d.showModal();
    cancel.focus();
  });
}
