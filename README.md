# Sails Hook Regon

This library allows you to get information about companies from the Polish REGON database.

## Getting Started
Install it via npm:
```bash
npm install sails-hook-regon --save
```
Configure `config/regon.js` in your project:
```javascript
module.exports.regon = {
  key: 'ee8f4cf5b45e8f44257',
};
```
Use the built-in method:
```javascript
sails.hooks.regon.<method>()
```
## Available methods
- searchByNip(nip): object

## License

[MIT](./LICENSE)
