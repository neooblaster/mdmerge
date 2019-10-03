* `[ ]` `@import>prog.abap:200,5,~pattern~:` : Fichier, Start Line, end offset et code block auto
* `[ ]` `@import>prog.abap:200,5,~pattern~2~:` : Fichier, Start Line, end offset et code block auto
* `[?]` `@import>prog.abap:200,5:210,10:` : Fichier, Start Line, end offset et code block auto
* `[ ]` `@import>prog.abap:200,5:210,~pattern~:` : Fichier, Start Line, end offset et code block auto
* `[ ]` `@import>prog.abap:200,5:210,~pattern~2~:` : Fichier, Start Line, end offset et code block auto
* `[ ]` `@import>prog.abap:~pattern~:` : Fichier, pattern de début (premiére occurence par défaut) et code block auto
* `[ ]` `@import>prog.abap:~pattern~2~:` : Fichier, pattern de début à la 2em occurence et code block auto
* `[ ]` `@import>prog.abap::~pattern~2~:` : Fichier, pattern de fin à la 2em occurence et code block auto
* `[ ]` `@import>prog.abap:200:@10:` : Fichier, Start Line à + 10 lignes, et code block auto
* `[ ]` `@import>prog.abap:@10:200:` : Fichier, 10 ligne avant la fine de la end line et code block auto
* `[ ]` `@import>prog.abap:@10:200:>prog.abap` : Fichier, 10 ligne avant la fine de la end line et code block auto, importer le program complet après