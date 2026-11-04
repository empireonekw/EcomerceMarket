/** PayFast sends its result as a query string (redirects) or a form POST; merge both into one plain object. */
export async function payfastParams(request) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  if (request.method === 'POST') {
    const type = request.headers.get('content-type') ?? '';
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      const form = await request.formData().catch(() => null);
      form?.forEach((value, key) => {
        if (typeof value === 'string') params[key] = value;
      });
    } else if (type.includes('application/json')) {
      Object.assign(params, await request.json().catch(() => ({})));
    }
  }
  return params;
}
