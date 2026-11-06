/** @type {import('next').NextMode} */
const nextConfig = {
  eslint: {
    // Permite que el despliegue en Vercel concluya aunque existan errores de ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;