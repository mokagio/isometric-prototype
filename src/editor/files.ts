/** Hand `text` to the browser as a download named `filename`. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoked a tick later: some browsers read the blob after `click` returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
