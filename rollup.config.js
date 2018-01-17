import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  output:
    {
      file: 'dist/index-es5-umd.js',
      name: 'rxcc',
      format: 'umd',
      sourcemap: true,
    },
  plugins: [
/*
// fails with Error: Cannot split a chunk that has already been edited : Rx.Observable
    resolve({
      jsnext: true,
      main: true,
      browser: true,
    }),
*/
    commonjs(),
    babel({
      exclude: 'node_modules/**',
    }),
    replace({
      ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    (process.env.NODE_ENV === 'production' && uglify()),
  ],
};
