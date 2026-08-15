/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.2.11',
    '192.168.2.11:3001',
    '192.168.2.11:3000',
    'localhost:3001',
    'localhost:3000',
  ],
};

export default nextConfig;
