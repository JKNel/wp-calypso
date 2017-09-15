
/**
 * This codeshift takes all of the imports for a file, and organizes them into two sections:
 * External dependencies and Internal Dependencies.
 *
 * It is smart enough to retain whether or not a docblock should keep a prettier/formatter pragma
 */
const fs = require( 'fs' );


/**
 * Gather all of the external deps and throw them in a set
 */
const packageJson = JSON.parse( fs.readFileSync( './package.json', 'utf8' ) );
const packageJsonDeps = []
	.concat( Object.keys( packageJson.dependencies ) )
	.concat( Object.keys( packageJson.devDependencies ) );

const externalDependenciesSet = new Set( packageJsonDeps );

const externalBlock = { type: "Block", value: "*\n * External dependencies\n " };
const internalBlock = { type: "Block", value: "*\n * Internal dependencies\n " };


/**
 * Returns true if the given text contains @format.
 * within its first docblock. False otherwise.
 *
 * @param {String} text text to scan for the format keyword within the first docblock
 */
const shouldFormat = text => {
	const firstDocBlockStartIndex = text.indexOf( '/**' );

	if ( -1 === firstDocBlockStartIndex ) {
		return false;
	}

	const firstDocBlockEndIndex = text.indexOf( '*/', firstDocBlockStartIndex + 1 );

	if ( -1 === firstDocBlockEndIndex ) {
		return false;
	}

	const firstDocBlockText = text.substring( firstDocBlockStartIndex, firstDocBlockEndIndex + 1 );
	return firstDocBlockText.indexOf( '@format' ) >= 0;
};


/**
 * Removes the extra newlines between two import statements
 */
const removeExtraNewlines = str => str.replace(/(import.*\n)\n(import)/g, '$1$2');
const isExternal = importNode => externalDependenciesSet.has( importNode.source.value );

module.exports = function ( file, api ) {
	const j = api.jscodeshift;
	const src = j(file.source);
	const declarations = src.find(j.ImportDeclaration);

	const withoutComments = declarations
	  .nodes()
	  .map( node => { node.comments = ''; return node } );

	const externalDeps = withoutComments.filter( node => isExternal( node ) );
	const internalDeps = withoutComments.filter( node => ! isExternal( node ) );


	if ( externalDeps[0]) {
		externalDeps[0].comments = [ externalBlock ];
	}
	if ( internalDeps[0] ) {
		internalDeps[0].comments = [ internalBlock ]
	}

	const includeFormatBlock = shouldFormat( src.toSource.toString() );
	const newDeclarations = []
		.concat( includeFormatBlock && '/** @format */')
		.concat( externalDeps )
		.concat('')
		.concat( internalDeps );

	declarations.remove();

	return removeExtraNewlines( src
		.find(j.Statement)
		.at(0)
		.insertBefore(newDeclarations)
		.toSource( { quote: 'single' } ) );
};
