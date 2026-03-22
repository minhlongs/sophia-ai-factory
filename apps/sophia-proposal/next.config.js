/** @type {import('next').NextConfig} */
const nextConfig = {
  // reactCompiler requires babel-plugin-react-compiler — disabled for CF Workers
  // reactCompiler: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
