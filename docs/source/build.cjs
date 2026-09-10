const path = require('path');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'effects.jsx')],bundle:true,minify:true,jsx:'automatic',outfile:path.join(__dirname,'../effects.js'),define:{'process.env.NODE_ENV':'"production"'},legalComments:'linked'});
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'core.js')],bundle:true,minify:true,outfile:path.join(__dirname,'../site-core.js')});
require('./build-page.cjs');
