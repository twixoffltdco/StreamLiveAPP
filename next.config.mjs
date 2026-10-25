/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Разрешаем показ превью-картинок (og:image) с любых удалённых доменов источников
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
