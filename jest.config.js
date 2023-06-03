module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	coverageReporters: ['text-summary'],
	collectCoverage: true,
	verbose: false,
	testMatch: ['/**/*.test.ts'],
	rootDir: './',
	moduleFileExtensions: ['ts', 'js'],
}
