const withPWA = require('@ducanh2912/next-pwa').default({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
    sw: 'sw.js',
    fallbacks: {
        document: '/offline',
    },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Otimizações para produção
    swcMinify: true,
    compress: true,
    poweredByHeader: false,

    // Variáveis de ambiente públicas
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '2.0.0',
    },

    // Headers de segurança
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin',
                    },
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains; preload'
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()'
                    }
                ],
            },
        ];
    },

    // Configurações experimentais para melhor performance
    experimental: {
        // Otimizações de performance
        optimizePackageImports: ['lucide-react', 'date-fns'],
    },

    // bcrypt não funciona no edge runtime; deve compilar no Node.js
    serverExternalPackages: ['bcrypt'],

    // Webpack customizations para otimizar bundle
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
        // Otimizações para produção
        if (!dev && !isServer) {
            // Reduzir tamanho do bundle
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    chunks: 'all',
                    minSize: 20000,
                    maxSize: 244000,
                    cacheGroups: {
                        default: {
                            minChunks: 2,
                            priority: -20,
                            reuseExistingChunk: true,
                        },
                        vendor: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendors',
                            priority: -10,
                            chunks: 'all',
                        },
                        // Separar bibliotecas específicas
                        react: {
                            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                            name: 'react',
                            chunks: 'all',
                            priority: 10,
                        },
                        charts: {
                            test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
                            name: 'charts',
                            chunks: 'all',
                            priority: 5,
                        },
                        icons: {
                            test: /[\\/]node_modules[\\/](lucide-react|react-icons)[\\/]/,
                            name: 'icons',
                            chunks: 'all',
                            priority: 5,
                        }
                    },
                },
            };
        }

        return config;
    },

    // TypeScript config
    typescript: {
        // ⚠️ CUIDADO: Permite build mesmo com erros de TypeScript
        // Mude para 'false' em produção para garantir qualidade
        ignoreBuildErrors: false,
    },

    // ESLint config
    eslint: {
        // ⚠️ CUIDADO: Permite build mesmo com warnings de ESLint
        // Mude para 'false' em produção para garantir qualidade
        ignoreDuringBuilds: false,
    },

    // Configurações de imagem otimizadas
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60,
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        // Adicione domínios se for usar imagens externas
        domains: [],
    },

    // Configurações para melhor SEO e performance
    generateBuildId: async () => {
        // ID de build único baseado no timestamp
        return `nexus-${Date.now()}`;
    },

    // Redirecionamentos (se necessário)
    async redirects() {
        return [
            // Exemplo: redirecionar /login para /auth/login
            // {
            //     source: '/login',
            //     destination: '/auth/login',
            //     permanent: true,
            // },
        ];
    },

    // Configurações de output para deployment
    output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

    // Configurações para desenvolvimento
    ...(process.env.NODE_ENV === 'development' && {
        // Apenas em desenvolvimento
        reactStrictMode: true,
    }),
};

module.exports = withPWA(nextConfig);