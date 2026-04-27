export async function handleMoneyCommand(input: string) {
  const parts = input.split(" ");

  const url = parts[1];
  const query = parts.slice(2).join(" ");

  if (!url || !query) {
    return `Usage:\n/money https://etsy.com "trending products"`;
  }

  const res = await fetch("http://localhost:3000/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: {
        id: "money",
        task: query,
        input: { url }
      }
    })
  });

  const data = await res.json();

  return `💰 Money Agent running → Job: ${data.jobId}`;
}

export async function handleMoneyVideoCommand(input: string) {
  const parts = input.split(" ");

  let url = parts[1];
  let query = parts.slice(2).join(" ");

  if (!url) {
    return `Usage:\n/money_video https://youtube.com/... "find winning products"\nOR\n/money_video "trending amazon products"`;
  }

  // If the first argument is not a URL, treat the entire input as a search query
  if (!url.startsWith('http')) {
    query = parts.slice(1).join(" ");
    url = ""; // We will search for a URL
  } else if (!query) {
    return `Usage:\n/money_video https://youtube.com/... "find winning products"\nOR\n/money_video "trending amazon products"`;
  }

  const res = await fetch("http://localhost:3000/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: {
        id: "money-video",
        task: query,
        input: { videoUrl: url, searchQuery: !url ? query : undefined }
      }
    })
  });

  const data = await res.json();

  return `🎬 Money Video Agent running → Job: ${data.jobId}`;
}
