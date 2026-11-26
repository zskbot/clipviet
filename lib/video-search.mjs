export function searchVideos(items, params) {
  const query = (params.get("q") || "").trim().toLocaleLowerCase("vi");
  const category = (params.get("category") || "").trim();
  const categoryId = (params.get("categoryId") || "").trim();
  const pageValue = Number(params.get("page") || 1);
  const limitValue = Number(params.get("limit") || 60);

  if (query.length > 120) throw new RangeError("Search query must be 120 characters or fewer.");
  if (category.length > 80 || categoryId.length > 120) throw new RangeError("Category filter is too long.");
  if (!Number.isInteger(pageValue) || pageValue < 1) throw new RangeError("Page must be a positive integer.");
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) throw new RangeError("Limit must be between 1 and 100.");

  const filtered = items.filter((video) => {
    if (category && video.category !== category) return false;
    if (categoryId) {
      const slug = String(video.category || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (video.categoryId !== categoryId && slug !== categoryId) return false;
    }
    if (!query) return true;
    const haystack = [video.title, video.description, video.category]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("vi");
    return haystack.includes(query);
  });

  const start = (pageValue - 1) * limitValue;
  return {
    results: filtered.slice(start, start + limitValue),
    total: filtered.length,
    page: pageValue,
    limit: limitValue,
    hasMore: start + limitValue < filtered.length
  };
}
