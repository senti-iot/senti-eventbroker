module.exports = {
	"env": {
		"browser": true,
		"es6": true,
		"commonjs": true
	},
	"extends": "eslint:recommended",
	"globals": {
		"Atomics": "readonly",
		"SharedArrayBuffer": "readonly"
	},
	"parserOptions": {
		"ecmaVersion": 2018
	},
	"rules": {
		"no-const-assign": "warn",
		"no-this-before-super": "warn",
		"no-undef": "warn",
		"no-unreachable": "warn",
		"no-unused-vars": "warn",
		"constructor-super": "warn",
		"valid-typeof": "warn",
		"indent": [
			"error",
			"tab",
			{
				"SwitchCase": 1,
				"ignoredNodes": ["TemplateLiteral"]
			}
		],
		"comma-spacing": [
			"error",
			{
				"before": false,
				"after": true
			}
		],
		"keyword-spacing": [
			"error",
			{
				"before": true,
				"after": true
			}
		],
		"key-spacing": [
			"error",
			{
				"beforeColon": false,
				"afterColon": true
			}
		],
		"object-curly-spacing": [
			"error",
			"always"
		],
		"space-infix-ops": "error",
		"space-before-blocks": "error",
		"arrow-spacing": "error",
		"jsx-a11y/href-no-hash": 0

	}
};