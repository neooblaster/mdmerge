#!/usr/bin/env node

/**
 * Chargement des dépendances.
 */
const fs       = require('fs');
const readline = require('readline');
const ifopt    = require('ifopt');
const log      = ifopt.log;
const clog     = console.log;
const cdir = function (obj) {
    console.dir(obj, {depth: null});
};


// Caractères individuels (n'accepte pas de valeur)
// Caractères suivis par un deux-points (le paramètre nécessite une valeur)
// Caractères suivis par deux-points (valeur optionnelle)
const options = {
    shortopt: "i:o:cwhDvs",
    longopt: [
        "in:",
        "out:",
        "clear",
        "write",
        "help",
        "debug",
        "verbose",
        "no-color",
        "strict"
    ],
};



/**
 * Déclaration des variables globales.
 */
let OPTS = null;
let PWD = process.env.PWD;
let IMPLICITS = {IFILE:null, OFILE: null};
let IFILE = null;
let OFILE = null;
let SHOWHELP = true;
let DEBUG = false;
let VERBOSE = false;



/**
 * Déclaration des fonctions.
 */

/**
 * Affiche le manuel d'aide.
 *
 * @param {Number} level  If we display the help next to an invalid command.
 *
 * @return void
 */
function help(level = 0) {
    let name = 'mdmerge';
    let helpText = `
Usage : ${name} [OPTIONS]
------------------------------------------------------------

{{${name}}} merge included file in output file.

{{-h}}, {{--help}}        Display this text.
{{-i}}, {{--in}}          File to be merged.
{{-o}}, {{--out}}         Output file which receive merged content.
{{-c}}, {{--clear}}       Remove included content in input file.
{{-w}}, {{--write}}       Overwrite input file with merged content.
{{-v}}, {{--verbose}}     Verbose Mode.
{{-D}}, {{--debug}}       Debug Mode.
{{-s}}, {{--strict}}      Do not modify included content.
    {{--no-color}}    Remove color in the console. Usefull to
                  redirect log in a debug file.

Implicits Options :
  • First  : Stand for input  file ({{-i}},{{--in}})
  • Second : Stand for output file ({{-o}},{{--out}})

Details :
  • Long options has the priority over Short ones
  • Short options has the priority over Implicit ones

    `;

    helpText = helpText.replace(
        /{{(.*?)}}/g,
        `${ifopt.colors.fg.Yellow}$1${ifopt.colors.Reset}`
    );

    console.log(helpText);
    if (level) process.exit();
}

function canRun() {
    return (IFILE);
}

/**
 * Vérifie si le fichier demandé existe.
 *
 * @param path   Emplacement du fichier à contrôller.
 * @param level  Niveau d'erreur à retourner en cas d'échec.
 *
 * @returns {boolean}
 */
function fileExists(path, level) {
    try {
        fs.accessSync(path, fs.constants.F_OK | fs.constants.W_OK, (err) => {
            if (err) {
                throw err;
            }
        });

        return true;
    } catch(err) {
        clog(err)
        //log(err, level, []);
        process.exit();
    }
}

/**
 * Lit le fichier spécifié
 *
 * @param file          Emplacement vers le fichier à traiter (master ou include).
 * @param nestedPath    Mémorisation des sous-dossiers invoqués, concaténés par appel de la fonction.
 * @param outputFile    Fichier de sortie (unique).
 * @param clearMode     Indicate to not perform inclusion and then to clear included content.
 * @param options       Options de lecture du fichier définie dans l'instruction.
 * @param depth         Niveau d'imbrication pour la gestion des titres inclus
 * @param wrapped       Indique si l'inclusion est dans un bloc enveloppé (codeblock)
 */
function readFile (
    file,
    nestedPath,
    outputFile,
    clearMode,
    options = {},
    depth = -1,
    wrapped = false
) {
    depth++;

    let lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);

    let writeOutput = true; // On n'ecrit pas le contenu si celui-ci est un contenu entre balise
    let started = false;    // Vrai si l'instruction de cut Start à été trouvée
    let ended = false;      // Vrai si l'instruction de cut End à été trouvée
    let oneline = false;    // Vrai si l'instruction de cut Online à été trouvée


    // Analyse du nesting dans la recursivité des appels readFile
    let fileFolderPath = file.match(/(.+\/)(.+)/);
    if (fileFolderPath) {
        fileFolderPath = fileFolderPath[1];
    } else {
        fileFolderPath = '';
    }

    if (nestedPath) {
        nestedPath = `${nestedPath}/${fileFolderPath}`;
    } else {
        nestedPath = fileFolderPath;
    }



    // Lecture de chaque ligne du fichier
    for (let l = 0; l < lines.length; l++) {
        let line = lines[l];

        let option = null;

        // Déterminer l'option qui convient :
        //  Si oneline, traiter la ligne demandée s'il s'agit d'elle
        //  Puis terminer la lecture du fichier définitivement
        //  Si on dispose des informations de cut start et end
        option = (options.oneline) ? options.oneline
            : (options.start && options.end) ? (
                (!started) ? options.start : options.end
            ) : null;

        // Si on à une option, analyse de l'option
        if (option) {
            // Memorisation de l'option originale qui est manipulée à chaque ligne
            // et nécessite un reset

            // Première lecture, cet argument n'existe pas. ne surtout pas mémorisée la ligne modifiée
            if(!option.option) option.option = Object.assign({}, option);
            // Remise à zéro
            option = Object.assign({}, option.option);
            // Mémorisation
            option.option = Object.assign({}, option);

            // Analyse du paramètre line si disponible
            readOption(option, 'line');

            // Analyse du paramètre beginOffset si disponible
            readOption(option, 'beginOffset');

            // Analyse du paramètre endOffset si disponible
            if (option.endOffset) readOption(option, 'endOffset');

        }
        // Si pas d'option, on est started
        else {
            started = true;
        }

        // Contrôle de la ligne (si spécifiée)
        if (option) {
            let lineMatch = false;

            switch (option.lineType) {
                case 'number':
                    //console.log("Check line ", option.line, l+1);
                    if (option.line === (l+1)) {
                        lineMatch = true;
                    }
                    break;
                case 'pattern':
                    //lineMatch = true;
                    break;
            }

            if (lineMatch) {
                // Si c'est une oneline.
                if (option.oneline) {
                    oneline = true;
                }
                // Si pas démarré, alors on démarre, désormais on enregistre
                if (!started) {
                    started = true;
                } else {
                    ended = true;
                }


                // Traiter les offset
                if (option.endOffset) {
                    line = line.substr(option.beginOffset, option.endOffset);
                } else {
                    line = line.substr(option.beginOffset);
                }
            }
        }



        // Si c'est une instruction, la traiter
        if (/^\[\]\([@#]import[><].+/.test(line)) {
            log("Include instruction found : %s", 4, [line]);

            let instruction = line;

            // Analyse de l'instruction
            let instructionData = readInstruction(instruction);
            let instructionRole = instructionData.role;
            let instructionType = instructionData.type;

            log("Instruction Data :", 4);
            if (DEBUG) cdir(instructionData);

            // Si c'est une instruction d'ouverture
            if (instructionRole === '>') {
                // Si c'est une instruction existante
                // reprocesser, mais bloquer l'écriture jusqu'à l'instruction de fin
                if (instructionType === '#') {
                    writeOutput = false;
                }

                // Si c'est une instruction nouvelle,
                // elle est impaire, on traitera la suite
                // mais il faut réécrire l'instruction avec le #
                // et ajouter une instruction de clôture
                if (instructionType === '@') {
                    instruction = instruction.replace(/@/, '#');
                }

                // Generer l'instruction de clôture
                let closingInstruction = instruction.replace(">", "<");

                // Securisation des instructions
                if (/(?<!\\)\s/.test(instruction)) {
                    instruction = instruction.replace(/\s/g, "\\ ");
                    closingInstruction = closingInstruction.replace(/\s/g, "\\ ");
                }

                // Procéder à l'inclusion des contenus.
                outputFile.write(instruction + "\n");
                if (!clearMode) instructionData.inclusions.map(function (inclusion) {
                    // Si on à demandé à envelopper dans un code block
                    // Saisir le code block
                    if (inclusion.code.wrapped) {
                        outputFile.write("````" + inclusion.code.language + "\n");
                    }

                    // Consolidation des cuts
                    //
                    //  [X] 200             => Debut=200,  Fin=EOF
                    //  [X] 200:300         => Debut=200,  Fin=300
                    //  [X] :300            => Debut=0,    Fin=300
                    //  [X] 200:300:400     => Debut=200,  Fin=300   & Debut=400 & Fin=EOF
                    //  [X] 200,1:300,,5    => Debut=200,1 Fin=300,5
                    //  [X] 200:300,1,2:400 => Debut=0,    Fin=200   & 300,1,2 & Debut=400, Fin=EOF
                    //  [X] 200:300:400,1,2 => Debut=200,  Fin=300   & 400,1,2
                    //  [X] 200:300:400,1   => Debut=200,  Fin=300   & Debut=400,1 Fin=EOF
                    //  [X] 200:300:400,,2  => Debut=200,  Fin=300   & 400,0,2
                    //  [X] 200:300,1       => Debut=0,    Fin=200   & 300,1,EOL
                    //  [X] ,1              => Debut=0,1   Fin=EOF
                    //
                    let lastCut = null;
                    let startCut = null;
                    let endCut = null;
                    let cutCouple = [];

                    // Parcourir chaque cut pour en constituer des couples
                    for(let c = 0; c < inclusion.cuts.length; c++) {
                        let cut = inclusion.cuts[c];

                        // Le cut est online si :
                        //  - Les 3 paramètres sont spécifiés
                        //  - Si le précédent cut n'est pas un cut start avec un endOffset
                        //  - Si le précédent cut est un cut start avec un beginStart
                        if (
                            (cut.line && cut.beginOffset && cut.endOffset) ||
                            (cut.line && cut.endOffset && !startCut) ||
                            (cut.line && cut.beginOffset && startCut)
                        ) {
                            // Si nous avions un cut avant celui-ci identifié en tant que startCut
                            // celui-ci deviens endCut et le startCut est generique
                            if (startCut) {
                                cutCouple.push({
                                    start: readCut(""),
                                    end: lastCut
                                });
                                startCut = null;
                            }

                            // Celui actuel est un couple oneline
                            cut.oneline = true;
                            cutCouple.push({
                                oneline: cut
                            })
                        }
                        // Traiter comme il se doit
                        else {
                            if (!startCut) {
                                startCut = cut;
                            } else {
                                endCut = cut;
                            }
                        }

                        // Lorsque nous avons un startCut et un endCut, on peu constituer un couple
                        // On remet tous à zéro pour les autres loop/
                        if (startCut && endCut) {
                            cutCouple.push({
                                start: startCut,
                                end: endCut
                            });

                            startCut = null;
                            endCut = null;
                        }

                        lastCut = cut;
                    }

                    // Si le startCut est défini, ici nous sommes plus dans la lecture
                    // des cuts. Il faut donc fixer un endCut à EOF
                    // Si le startCut est défini, il faut fixer la fin à EOF
                    if (startCut) {
                        cutCouple.push({
                            start: startCut,
                            end: readCut("")
                        });
                        startCut = null;
                    }

                    // Restaurer les caractères échappés
                    inclusion.file = inclusion.file.replace(/\\\s/g, ' ');

                    // Exécuter les couples pour l'insertion des données du fichier.
                    if (cutCouple.length > 0) {
                        cutCouple.map(function (couple) {
                            fileExists(`${nestedPath}${inclusion.file}`, 1);
                            readFile(
                                `${nestedPath}${inclusion.file}`,
                                nestedPath,
                                outputFile,
                                clearMode,
                                couple,
                                depth,
                                inclusion.code.wrapped
                            );
                        });
                    } else {
                        fileExists(`${nestedPath}${inclusion.file}`, 1);
                        readFile(
                            `${nestedPath}${inclusion.file}`,
                            nestedPath,
                            outputFile,
                            clearMode,
                            {},
                            depth,
                            inclusion.code.wrapped
                        );
                    }

                    // Si on avait demandé à envelopper dans un code block
                    // Saisir le codede côture
                    if (inclusion.code.wrapped) {
                        outputFile.write("````\n");
                    }
                });
                outputFile.write(closingInstruction + "\n");
            }

            // Si c'est une instruction de clôture.
            if (
                instructionRole === '<' &&
                instructionRole === '#'
            ) {
                //outputFile.write(instruction + "\n");
                writeOutput = true;
            }
        }

        // Ce n'est pas une instruction,
        // saisir le contenu si autorisé et en accord avec les options specifiées
        else {
            //console.log("Pas une instruction", line);
            // Si ce n'est pas du contenu entre balise
            if (writeOutput) {
                //console.log("WriteOutput: pas de contenu de balise");

                // Vérifier que la line que nous devons écrire ne contient pas
                // un emplacement qui est relatif
                //@TODO, chek début pour commencement par /. Ne rien faire si oui
                let pathToFile = null;
                // #1 Modele Markdown 1 : [XX]: path/to/file
                let mdPattern1 = /(.*)(\[.*\]:\s*)(.*\/?.*)(.*)/;
                // #2 Modele Markdown 2 : ![](path/to/file)
                let mdPattern2 = /(.*)(\[.*\])(\()(.*)(\))(.*)/;
                // #3 Balise HMTL img    : src="path/to/file"
                // #4 Attribut HTML      : url('path/to/file')*

                // Case #1 : Modèle Markdown 1 :
                if (mdPattern1.test(line)) {
                    pathToFile = line.match(mdPattern1);

                    line = pathToFile[1]             // Chaine avant
                        + pathToFile[2]              // Début Modele MD1 (alt)
                        + nestedPath + pathToFile[3] // Path (ref)
                        + pathToFile[4];             // Fin
                }

                // Case #2 : Modèle Markdown 2 :
                if (mdPattern2.test(line)) {
                    pathToFile = line.match(mdPattern2);

                    line = pathToFile[1]             // Chaine avant
                        + pathToFile[2]              // Début Modele MD2 (alt)
                        + pathToFile[3]              // Parenthèse (
                        + nestedPath + pathToFile[4] // Path (path)
                        + pathToFile[5]              // Parenthèse )
                        + pathToFile[6];             // Fin
                }

                // S'il s'agit d'un titre markdown,
                // il faut le rendre en tant que sous niveau
                // en fonction du niveau d'imbrication
                // sous condition de ne pas être en codeblock
                // sous condition de ne pas inclure en stricte
                // Le niveau 0 n'est pas en inclusion, c'est l'appel root
                if (depth > 0 && !wrapped && !ifopt.isOption(['strict', 's'])) {
                    // Commence strictement par un # (espace admis)
                    if (/^\s*#/.test(line)) {
                        let levelExtension = '#'.repeat(depth);
                        let replace = line.replace(/^(\s*)([#]+)(.*)$/gi, `$1${levelExtension}$2$3`);
                        log("Include title '%s' found extended to '%s'", 4, [line, replace]);
                        line = replace;
                    }
                }

                // Si on à démarré l'écriture ou on a affaire à une oneline
                if (started || oneline) {
                    //console.log("Ecrire", line);
                    //console.log("");
                    outputFile.write(line + "\n");
                }

                // Si oneline, terminer la lecture ICI
                if (oneline) break;
                // Si ended, RAZ des flags, ca continuera sans écrire
                if (ended) {
                    started = false;
                    ended = false;
                }
            }
        }
    }
}

/**
 * Parse l'instruction Markdown d'inclusion.
 *
 * @param instruction   Instruction à traiter.
 *
 * @returns {{role: null, type: null, inclusions: Array}}
 */
function readInstruction (instruction) {

    //log("INS:" + instruction);

    let options = {
        role: null,
        type: null,
        inclusions: []
    };

    let inclusionOptionsTemplate = {
        file: null,
        cuts: [],
        code: {
            wrapped: false,
            language: null
        }
    };

    // Instruction tag
    options.role = instruction.split(/^\[\]\([@#]import([><])/)[1];
    options.type = instruction.split(/^\[\]\(([@#])/)[1];

    // Récupération des arguments
    let arguments = instruction.split(/^\[\]\([@#]import[><](.+)\)$/)[1];
    let inclusions = arguments.split(/>/);

    inclusions.map(function(inclusion) {
        let inclusionOption = Object.assign({}, inclusionOptionsTemplate);
        let inclusionElmt = inclusion.split(/:/);

        let codeElement = false;

        // Fichier est toujours en premier
        inclusionOption.file = inclusionElmt[0];

        // Analyse du dernier element
        if (inclusionElmt.length > 1) {
            let element = inclusionElmt[inclusionElmt.length - 1];

            // Si le dernier est vide ou est une chaine de texte
            // Alors c'est une code block
            if (
                element === '' ||
                !/^([0-9,]+)([0-9,]+)?([0-9]+)?$/.test(element)
            ) {
                codeElement = true;
                inclusionOption.code.wrapped = true;
                inclusionOption.code.language = element;
            }
        }

        // Dans tous les cas, il faut traiter les elements du milieux
        // Le premier est le fichier
        // Lorsque le dernier est le code block, on l'ignore
        for (let i = 1; i < inclusionElmt.length; i++) {
            if (codeElement && i === (inclusionElmt.length - 1)) {
                break;
            }

            inclusionOption.cuts.push(readCut(inclusionElmt[i]));
        }


        //log("CUTS:" + inclusionOption.cuts.length + ' => ' + inclusionOption.cuts.join(' && '));
        //log("CODE:" + codeElement);
        //log("");
        //log("");

        options.inclusions.push(inclusionOption)
    });

    return options;
}

/**
 * Parse l'instruction de cut dans le fichier
 *
 * @param cut  Instruction de cut
 */
function readCut (cut) {

    let cutTemplate = {
        line: 0,
        beginOffset: 0,
        endOffset: null
    };

    let cutElements =  cut.split(/,/);
    let cutElement = Object.assign({}, cutTemplate);

    // Si trois elements, le dernier est le endOffset
    if (cutElements.length >= 3) {
        cutElement.endOffset = cutElements[2] || null;
    }

    // Si deux elements au moins, le second est bien le beginOffset
    if (cutElements.length >= 2) {
        cutElement.beginOffset = cutElements[1] || null;
    }

    // Si au minimum un element, il s'agit de la ligne.
    if (cutElements.length >= 1) {
        cutElement.line = cutElements[0] || null;
    }

    return cutElement;
}

/**
 * Lit la donnée saisie pour l'argument spécifié, dans l'option et ajoute une propriété donnant le type
 *
 * @param option    Option à lire et à compléter (Object pour référence).
 * @param argument  Chaine de text nommant la propriété (argument) à analyser.
 */
function readOption (option, argument) {
    if (!option.line) option.line = 1;
    if (!option.beginOffset) option.beginOffset = 0;

    // Si c'est une valeur numérisable on l'assimile
    if (/^[0-9]+/.test(option[argument])) {
        option[argument] = parseInt(option[argument]);
        option[`${argument}Type`] = "number";
    }
    // Si ce n'est pas un pattern, on ne sait pas faire
    else if (!/^~(.+)~/.test(option[argument])) {
        log("Element %s unknow in %s", 1, [option[argument]]);
        process.exit();
    } else {
        option[argument] = option[argument].split(/~(.+)~/)[1]; //@TODO voir pour l'element de récurrence
        option[`${argument}Type`] = "pattern";
    }
}



/**
 * Lecture des arguments du script.
 */
OPTS = ifopt.getopt(
    options.shortopt,
    options.longopt,
    ['IFILE', 'OFILE'],
    IMPLICITS
);
ifopt.setLogLevel('VERBOSE', false, [3]);
ifopt.setLogLevel('DEBUG', false, [4]);

/**
 * Traitement des options
 */
IFILE = OPTS.in ? OPTS.in.val : OPTS.i ? OPTS.i.val : IMPLICITS.IFILE;
OFILE = OPTS.out ? OPTS.out.val : OPTS.o ? OPTS.o.val : IMPLICITS.OFILE;

if (OPTS.w || OPTS.write) {
    OFILE = IFILE;
}

if (ifopt.isOption(["v", "verbose"])) {
    VERBOSE = true;
    ifopt.setLogLevel('VERBOSE', true);
}

if (ifopt.isOption(["D", "debug"])) {
    DEBUG = true;
    ifopt.setLogLevel('DEBUG', true);
}


/**
 * Création d'un fichier temporaire
 */
let TMP_FILE = `${IFILE}.tmp`;
let tmpFile = fs.createWriteStream(TMP_FILE, {});


/**
 * Traitement en fonction des options
 */
CLEAR = OPTS.clear ? true : !!OPTS.c;

// Traitement du fichier
if (canRun()) {
    // Check if file exist
    fileExists(IFILE, 1);

    log("Read file %s", 3, [IFILE]);

    readFile(IFILE, '', tmpFile, CLEAR);

    // Updating file :
    // Si le fichier de sortie n'est pas spécifié,
    // Utiliser <FILE>.merged.md par défaut
    if (!OFILE) {
        OFILE = IFILE;
        OFILE = OFILE.replace(/\.md$/, '.merged.md');
    }
    fs.rename(TMP_FILE, OFILE, function(err) {
        if (err) throw err;
    });

    SHOWHELP = false;
}


if (SHOWHELP) {
    log("No specified file to process", 1);
    help();
}