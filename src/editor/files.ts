/**
 * Ask for a `.json` file and hand back its text. Resolves to `null` if the
 * picker is dismissed — which browsers do not report, so this settles only when
 * a file actually arrives.
 */
export function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
    input.click();
  });
}

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
