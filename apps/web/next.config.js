/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/types", "@repo/validators"],
};

// #region agent log
fetch('http://127.0.0.1:7244/ingest/1f3315a9-f16e-4f25-9887-ba3e032e7cca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'apps/web/next.config.js:8',message:'Loaded next.config as ESM',data:{hasTypeModule:true,keys:Object.keys(nextConfig)},timestamp:Date.now()})}).catch(()=>{});
// #endregion

export default nextConfig;
