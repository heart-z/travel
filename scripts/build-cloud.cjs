require('esbuild').buildSync({entryPoints:['src/domain/trips.ts'],bundle:true,platform:'node',target:'node16',format:'cjs',outfile:'cloudfunctions/travel/domain.cjs'});
