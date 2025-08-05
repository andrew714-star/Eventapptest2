// Environment helper to load API keys
// Since Vite requires VITE_ prefix for environment variables, 
// we'll fetch the API key from the server instead

let mapTilerApiKey: string | null = null;

export async function getMapTilerApiKey(): Promise<string> {
  if (mapTilerApiKey) {
    return mapTilerApiKey;
  }

  try {
    const response = await fetch('/api/config/maptiler-key');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('API Key response:', data);
    mapTilerApiKey = data.apiKey;
    return mapTilerApiKey || '';
  } catch (error) {
    console.error('Failed to fetch MapTiler API key:', error);
    return '';
  }
}