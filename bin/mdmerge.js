#!/usr/bin/env node

/**
 * Chargement des dépendances.
 */
const fs = require('fs');
const readline = require('readline');
const colors = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",
    fg: {
        Black: "\x1b[30m",
        Red: "\x1b[31m",
        Green: "\x1b[32m",
        Yellow: "\x1b[33m",
        Blue: "\x1b[34m",
        Magenta: "\x1b[35m",
        Cyan: "\x1b[36m",
        White: "\x1b[37m",
        Crimson: "\x1b[38m"
    },
    bg: {
        Black: "\x1b[40m",
        Red: "\x1b[41m",
        Green: "\x1b[42m",
        Yellow: "\x1b[43m",
        Blue: "\x1b[44m",
        Magenta: "\x1b[45m",
        Cyan: "\x1b[46m",
        White: "\x1b[47m",
        Crimson: "\x1b[48m"
    }
};
// Caractères individuels (n'accepte pas de valeur)
// Caractères suivis par un deux-points (le paramètre nécessite une valeur)
// Caractères suivis par deux-points (valeur optionnelle)
const options = {
    shortopt: "i:o:cw",
    longopt: [
        "in:",
        "out:",
        "clear",
        "write"
    ],
};



/**
 * Déclaration des variables globales.
 */
let PWD = process.env.PWD;
let IFILE = null;
let OFILE = null;



/**
 * Déclaration des fonctions.
 */

/**
 * Traiter les arguments passé au programme
 *
 * @param shortopt  Définition des options courtes.
 * @param longopt   Définition des options longues.
 * @returns {{}}    Options parsées.
 */
function getopt(shortopt, longopt = []) {
    checkShortopt(shortopt);

    let processedArg = 0;
    let implicitArg = 1;
    let procOptions = {};  // .optarg, .opt, .optval

    process.argv.forEach(function(arg) {
        processedArg++;

        // Skip Interpreter (node.exe) and it self (mdmerge.js)
        if (processedArg < 3) return;


        // Check if it is a explicit argument (longopt).
        if (/^--/.test(arg)) {
            let splitOpt = arg.match(/^--([a-zA-Z0-9._-]+)=?(.*)/);
            if (!splitOpt) return;
            let opt = splitOpt[1];
            let optVal = splitOpt[2];

            for(let i = 0; i < longopt.length; i++) {
                let lgOpt = longopt[i].match(/([a-zA-Z0-9._-]+)(:*)/);
                let lgOptName = lgOpt[1];
                let lgOptConfig = lgOpt[2];

                if (opt === lgOptName) {
                    if (lgOptConfig === ':' && !optVal) {
                        log(`Option '--${opt}' require a value`, 1, []);
                    }

                    procOptions[opt] = createOption(arg, opt, optVal);
                }
            }
        }

        // Check if it is a explicit argument (shortopt).
        else if (/^-/.test(arg)) {
            let opt = arg.substr(1, 1);
            let optIdx = shortopt.indexOf(opt);
            let optVal = arg.match(/^-(.+)=(.*)/);
            if (optVal) optVal = optVal[2];

            if (optIdx < 0 ) return;

            let nextOptChar1 = shortopt.substr(optIdx +1, 1);
            let nextOptChar2 = shortopt.substr(optIdx +2, 1);

            if (nextOptChar1 === ':' && nextOptChar2 !== ':' && !optVal) {
                log(`Option '-${opt}' require a value`, 1, []);
                return;
            }

            procOptions[opt] = createOption(arg, opt, optVal);
        }

        // This is an implicit argument.
        else {
            switch (implicitArg) {
                // First implicit goes to Input File IFILE.
                case 1:
                    IFILE = arg;
                    break;
                // Second implicit goes to Output File OFILE.
                case 2:
                    OFILE = arg;
                    break;
            }

            implicitArg++;
        }
    });

    return procOptions;
}

// validation de la chaine shortopt pour limiter les doublons
function checkShortopt () {

}

/**
 *  Créer une option parsée pour utilisation ultérieure.
 *
 * @param optarg    Option d'origine passée en argument.
 * @param opt       Option isolée.
 * @param optval    Valeur de l'option.
 *
 * @returns {{optarg: *, opt: *, optval: *}}
 */
function createOption(optarg, opt, optval) {
    return {
        "arg": optarg,
        "opt": opt,
        "val": optval
    };
}

/**
 * Afficher un message dans le stream.
 *
 * @param message Message à afficher.
 * @param level   Niveau de message. 0=OK,1=KO,2=WARN.
 * @param args    Arguments which will replace placeholder in message.
 */
function log(message, level = 0, args = []){
    // 0 = Success
    // 1 = Error
    // 2 = Warn
    // 3 = Info
    let levels = [
        {color: "Green", name: "SUCCESS", return: 0},
        {color: "Red", name: "ERROR", return: 1},
        {color: "Yellow", name: "WARNING", return: 0},
        {color: "Cyan", name: "INFO", return: 0},
    ];

    console.log(
        "[ " +
        colors.fg[levels[level].color] +
        levels[level].name +
        colors.Reset +
        " ] : " +
        message
    );

    return levels[level].return;
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
        log(err, level);
        process.exit();
    }
}

/**
 * Lit le fichier spécifié
 *
 * @param file          Emplacement vers le fichier à traiter (master ou include).
 * @param outputFile    Fichier de sortie (unique).
 * @param clearMode     Indicate to not perform inclusion and then to clear included content.
 * @param options       Options de lecture du fichier définie dans l'instruction.
 */
function readFile (file, outputFile, clearMode, options = {}) {
    let lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);

    let writeOutput = true; // On n'ecrit pas le contenu si celui-ci est un contenu entre balise
    let started = false;    // Vrai si l'instruction de cut Start à été trouvée
    let ended = false;      // Vrai si l'instruction de cut End à été trouvée
    let oneline = false;    // Vrai si l'instruction de cut Online à été trouvée


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
            //console.log("Une instruction", line);
            //console.log("");

            let instruction = line;

            // Analyse de l'instruction
            let instructionData = readInstruction(instruction);
            //console.log(instructionData);
            let instructionRole = instructionData.role;
            let instructionType = instructionData.type;

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
                closingInstruction = instruction.replace(">", "<");

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
                            fileExists(inclusion.file, 1);
                            readFile(inclusion.file, outputFile, clearMode, couple);
                        });
                    } else {
                        fileExists(inclusion.file, 1);
                        readFile(inclusion.file, outputFile, clearMode);
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
let OPTS = getopt(options.shortopt, options.longopt);

/**
 * Traitement des options
 */
IFILE = OPTS.in ? OPTS.in.val : OPTS.i ? OPTS.i.val : IFILE;
OFILE = OPTS.out ? OPTS.out.val : OPTS.o ? OPTS.o.val : OFILE;

if (OPTS.w || OPTS.write) {
    OFILE = IFILE;
}


/**
 * Vérifier qu'on à spécifier un fichier à traiter
 */
if (!IFILE) {
    log("No specified file to process", 1);
    return false;
}


/**
 * Vérification de l'existance du fichier.
 */
fileExists(IFILE, 1);


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
readFile(IFILE, tmpFile, CLEAR);


/**
 * Mise à jour du fichier
 */
// Si le fichier de sortie n'est pas spécifié,
// Utiliser <FILE>.merged.md par défaut
if (!OFILE) {
    OFILE = IFILE;
    OFILE = OFILE.replace(/\.md$/, '.merged.md');
}
fs.rename(TMP_FILE, OFILE, function(err) {
    if (err) throw err;
});
