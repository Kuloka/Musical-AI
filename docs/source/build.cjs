const path = require('path');
require('./build-page.cjs');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'effects.jsx')],bundle:true,minify:true,jsx:'automatic',outfile:path.join(__dirname,'../effects.js'),define:{'process.env.NODE_ENV':'"production"'},legalComments:'linked'});
