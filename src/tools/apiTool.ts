export async function fetchJSON(url: string) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return await res.json();
}
