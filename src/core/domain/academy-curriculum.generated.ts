// Generado con scripts/build_academy_curriculum.py; no editar manualmente.
import type { AcademyCurriculumMaterialIdentity, AcademyCurriculumTopic } from './academy-curriculum-types.js';
type AcademyCurriculumModule = { academyCurriculumTopic: AcademyCurriculumTopic };
export const academyCurriculumTopicLoaders: Record<string, () => Promise<AcademyCurriculumModule>> = {
  "T1.01": () => import("./academy-curriculum.generated/T1.01.generated.js"),
  "T1.02": () => import("./academy-curriculum.generated/T1.02.generated.js"),
  "T1.03": () => import("./academy-curriculum.generated/T1.03.generated.js"),
  "T1.04": () => import("./academy-curriculum.generated/T1.04.generated.js"),
  "T1.05": () => import("./academy-curriculum.generated/T1.05.generated.js"),
  "T1.06": () => import("./academy-curriculum.generated/T1.06.generated.js"),
  "T1.07": () => import("./academy-curriculum.generated/T1.07.generated.js"),
  "T1.08": () => import("./academy-curriculum.generated/T1.08.generated.js"),
  "T1.09": () => import("./academy-curriculum.generated/T1.09.generated.js"),
  "T1.10": () => import("./academy-curriculum.generated/T1.10.generated.js"),
  "T1.11": () => import("./academy-curriculum.generated/T1.11.generated.js"),
  "T2.01": () => import("./academy-curriculum.generated/T2.01.generated.js"),
  "T2.02": () => import("./academy-curriculum.generated/T2.02.generated.js"),
  "T2.03": () => import("./academy-curriculum.generated/T2.03.generated.js"),
  "T2.04": () => import("./academy-curriculum.generated/T2.04.generated.js"),
  "T2.05": () => import("./academy-curriculum.generated/T2.05.generated.js"),
  "T3.01": () => import("./academy-curriculum.generated/T3.01.generated.js"),
  "T3.02": () => import("./academy-curriculum.generated/T3.02.generated.js"),
  "T3.03": () => import("./academy-curriculum.generated/T3.03.generated.js"),
  "T3.04": () => import("./academy-curriculum.generated/T3.04.generated.js"),
  "T3.05": () => import("./academy-curriculum.generated/T3.05.generated.js"),
  "T3.06": () => import("./academy-curriculum.generated/T3.06.generated.js"),
  "T3.07": () => import("./academy-curriculum.generated/T3.07.generated.js"),
  "T3.08": () => import("./academy-curriculum.generated/T3.08.generated.js"),
  "T3.09": () => import("./academy-curriculum.generated/T3.09.generated.js"),
  "T3.10": () => import("./academy-curriculum.generated/T3.10.generated.js"),
  "T4.01": () => import("./academy-curriculum.generated/T4.01.generated.js"),
  "T4.02": () => import("./academy-curriculum.generated/T4.02.generated.js"),
  "T4.03": () => import("./academy-curriculum.generated/T4.03.generated.js"),
  "T4.04": () => import("./academy-curriculum.generated/T4.04.generated.js"),
  "T4.05": () => import("./academy-curriculum.generated/T4.05.generated.js"),
  "T4.06": () => import("./academy-curriculum.generated/T4.06.generated.js"),
  "T4.07": () => import("./academy-curriculum.generated/T4.07.generated.js"),
  "T4.08": () => import("./academy-curriculum.generated/T4.08.generated.js"),
  "T4.09": () => import("./academy-curriculum.generated/T4.09.generated.js"),
  "T4.10": () => import("./academy-curriculum.generated/T4.10.generated.js"),
};
export const academyCurriculumMaterialIndex: Record<string, readonly AcademyCurriculumMaterialIdentity[]> = {
  "T1.01": [
    {
      "path": "T1.01 Constitución Española/T1.01 Constitución Española - Temario (version alternativa).pdf",
      "kind": "syllabus",
      "sha256": "4eba1a47e754a3c13d896670c6884c46c24827375836418fb7536d2e1de35b67",
      "outlineFingerprint": "bfdc3440f91a7cda74aa98f7e7ce161fbfb253f7de3f0a443e0ae7a6569344d8",
      "outlineStructureFingerprint": "4ce4bfcb37c1d1f6fde1878c1d216d394730fc09036571510a8c1a4a940ddff9"
    },
    {
      "path": "T1.01 Constitución Española/T1.01 Constitución Española - Temario.pdf",
      "kind": "syllabus",
      "sha256": "a69d661e50cf8cce3f6f43dbaea156e5ee4bcef1162f9bad2f9a200278f57f5b",
      "outlineFingerprint": "bfdc3440f91a7cda74aa98f7e7ce161fbfb253f7de3f0a443e0ae7a6569344d8",
      "outlineStructureFingerprint": "4ce4bfcb37c1d1f6fde1878c1d216d394730fc09036571510a8c1a4a940ddff9"
    }
  ],
  "T1.02": [
    {
      "path": "T1.02 Cortes Generales/T1.02 Cortes Generales - Temario.pdf",
      "kind": "syllabus",
      "sha256": "a826e75d13d409bfd8af8c56def14f629a1242c26c0ad09f5c67de7981fb1783",
      "outlineFingerprint": "e01cb5d7d9f262d66583513f2e5f7a3c656104e6c2ba66a90d101de772ea480e",
      "outlineStructureFingerprint": "0df12cef0b6d1805f499af4478559fb76933c9dd0ee1bc038df7ae788d5b8305"
    }
  ],
  "T1.03": [
    {
      "path": "T1.03 Gobierno/T1.03 Gobierno - Temario OPO.pdf",
      "kind": "syllabus",
      "sha256": "ae5841c8133e8a39f9acd68a30bde1ec4172c485c1b94bade9e1334e894137da",
      "outlineFingerprint": "6932428b5773b5f336e94e304eec89801ed2c74938848a4b91c995d5bff89d77",
      "outlineStructureFingerprint": "f68edbeec42045a6ac062d9a5d25a7c7def6c629239dfe9f6d7f87b42890ace8"
    }
  ],
  "T1.04": [
    {
      "path": "T1.04 Transparencia/T1.04 Transparencia - Temario.pdf",
      "kind": "syllabus",
      "sha256": "792e290d60098ee9bf36896087c55d2a7de7bd94edfc05fef440798556525444",
      "outlineFingerprint": "c9ddeb961ebf7fcbf4516c9f873ec7779fc42855263169c1dfe99bad71685f62",
      "outlineStructureFingerprint": "621d35174b1e9875b21febf510d7d9b5f6300c8be80b002825bb32205dfb9809"
    }
  ],
  "T1.05": [
    {
      "path": "T1.05 TREBEP/T1.05 TREBEP - Temario.pdf",
      "kind": "syllabus",
      "sha256": "8ed9d7b96e099356e62602766f4a37eb15df7a18af84f17555f87d0cbe11a4e2",
      "outlineFingerprint": "dfd9fd282db530bbec971ae7f4249888cc963eb70911df8c721528cea4ca8482",
      "outlineStructureFingerprint": "8e7947ed8f7cc3e05a72fd638b1326aa2e886962b86a980dd32fed9fc6dbcb70"
    }
  ],
  "T1.06": [
    {
      "path": "T1.06 Fuentes del Derecho/T1.06 Fuentes del Derecho - Temario OPO.pdf",
      "kind": "syllabus",
      "sha256": "4a2f6932755a6d48a2bd0d8d179707b9cacab6dcd466e7bfd2654a5d27170c1d",
      "outlineFingerprint": "735a1600181b7ba1cf11f58f1bcd02854890bd49ad88c20555200ce11d1ee201",
      "outlineStructureFingerprint": "2faaa7ae220d34c99a4e05e03189be02f32c83fa1984dea2798e18299ae36385"
    }
  ],
  "T1.07": [
    {
      "path": "T1.07 Políticas de Igualdad/T1.07 Políticas de Igualdad - Temario.pdf",
      "kind": "syllabus",
      "sha256": "87083522e2f662659e2f016cc5fbd2a68f0bad091543d640ab88bdcac34dfa9a",
      "outlineFingerprint": "1f9c913499b40e769b7b5b3d8cd7ba2a5d63db78d2317790177fcf59aa78fcf2",
      "outlineStructureFingerprint": "20de43efd8414897dc2db2f39ef56807cdb225efcf053d3f1f408b108f37dfc5"
    }
  ],
  "T1.08": [
    {
      "path": "T1.08 Sociedad de la Información/T1.08 Sociedad de la Información - Temario.pdf",
      "kind": "syllabus",
      "sha256": "5f258b7cc3f23f39e1f8f4dbdf0679f85d8ff3c499df62a43cf011dcf27e391f",
      "outlineFingerprint": "2ea44a96eb5af2df6487c56435b04f21815923943d8bb5a4df05225c719e6991",
      "outlineStructureFingerprint": "395851f2250463bc1655ba39bb153398df26c14de2920167ff480b468813bc97"
    }
  ],
  "T1.09": [
    {
      "path": "T1.09 Protección de Datos/T1.09 Protección de Datos - Temario.pdf",
      "kind": "syllabus",
      "sha256": "0e4d094116cca7f3a255d1daee0a04b5d72fdda65f8c0cba1bdcd1286c364e49",
      "outlineFingerprint": "fb3ec5635322077d07baf2f7f77934ea95600d70d97700d5003e7a412d929f7a",
      "outlineStructureFingerprint": "852b4bbc130d94d03e8afd9f50192dc2d7e021dbcef211557bc700b1265279d5"
    }
  ],
  "T1.10": [
    {
      "path": "T1.10 Acceso Electrónico/T1.10 Acceso Electrónico - Temario - parte1.pdf",
      "kind": "syllabus",
      "sha256": "65544a91022ee92fcf4b81dbdfe5bd23ad28da9e0ef048a8d2094f6fd2bb7598",
      "outlineFingerprint": "65523bb6acb40c7174f30b1a83e8d83cb51605e319d070cd3ad39e1d701566c1",
      "outlineStructureFingerprint": "b7b74ca0955d93af6438412d8e04dc2fe5bd693ecfeeacba12e8c36b2d6e5c45"
    },
    {
      "path": "T1.10 Acceso Electrónico/T1.10 Acceso Electrónico - Temario - parte2.pdf",
      "kind": "syllabus",
      "sha256": "6ee41d275d37973d7eb3e8cfef14c01ccdebc34b82d9a3281aaaf9ced288685a",
      "outlineFingerprint": "1c6166ca60d522e5db6d3a047cbb5a75c78d9608c4db4e1a264097d12637d754",
      "outlineStructureFingerprint": "57a38a526bf7863c7ed8d313707c05fcdd5efcf4dbecbed0f880e9c42fa73ece"
    }
  ],
  "T1.11": [
    {
      "path": "T1.11 Instrumentos de Acceso Electrónico/T1.11 Instrumentos de Acceso Electrónico - Temario.pdf",
      "kind": "syllabus",
      "sha256": "090809ed96a6a340cc2052292870108310e85e1cd99294d403149be27ba4c51a",
      "outlineFingerprint": "bef7b466ca27712129f720ee35c4b34db27991a03e77c029eb7c202d1abc07c7",
      "outlineStructureFingerprint": "608a07e977869f8be11a5bbbe1c4dd8911bb88f0967462d223ebd3366d3c24f5"
    }
  ],
  "T2.01": [
    {
      "path": "T2.01 Informática Básica/T2.01 Informática Básica - Temario (version alternativa).pdf",
      "kind": "syllabus",
      "sha256": "f970a0610c42027752deff031e57ff88c8266330e31549b84422e1fca1651606",
      "outlineFingerprint": "61ab6bc592b43ec0c687ad55e6ce521513c4fb21c5a7f512c99117274bd936b7",
      "outlineStructureFingerprint": "fa1b1ec6a21d63b63b0c4e10e5dc24e2f2dd1b6415c7646d3f9bc387d5d68fd6"
    },
    {
      "path": "T2.01 Informática Básica/T2.01 Informática Básica - Temario.pdf",
      "kind": "syllabus",
      "sha256": "f569674274fbe378727b5cc4073872ef5273b2e93e94d51912dd322852e9b437",
      "outlineFingerprint": "3d096d8ebb7a6c4c8f495c4484c064a39a8ab5e635130579bb7b6aa5acb6fd6a",
      "outlineStructureFingerprint": "fa1b1ec6a21d63b63b0c4e10e5dc24e2f2dd1b6415c7646d3f9bc387d5d68fd6"
    }
  ],
  "T2.02": [
    {
      "path": "T2.02 Periféricos/T2.02 Periféricos - Temario.pdf",
      "kind": "syllabus",
      "sha256": "963ced123c0fe2900b51d666f04e1dd593c9d9f65add543b87ee6af27af953af",
      "outlineFingerprint": "9d50643129e36b891fd28f7f233f613a665664c489107f61feda03ba28c70175",
      "outlineStructureFingerprint": "279a6c00f75a9e4c122eba9c0e443e5553e8a06592ef67fb449a4a1ffae3ea8c"
    }
  ],
  "T2.03": [
    {
      "path": "T2.03 Estructuras de Datos/T2.03 Estructuras de Datos - Temario.pdf",
      "kind": "syllabus",
      "sha256": "84f1ed094c810f65fb7e5f9ddd93a98003fe9d707d6f3c90d92b6de720cb902a",
      "outlineFingerprint": "4a00d1167ea8029dff485b1d8ca74716c739bf36ca5a5dc9ba61ade4a3047b79",
      "outlineStructureFingerprint": "83a1af874e12672cbb197604524db4dd1276475cf72a429ef6558c45b0cc92d8"
    }
  ],
  "T2.04": [
    {
      "path": "T2.04 Sistemas Operativos/T2.04 Sistemas Operativos - Temario.pdf",
      "kind": "syllabus",
      "sha256": "d90c16c37eb47ab64152e40b217794d257fc0c1f0457311dc82b71987609f0e1",
      "outlineFingerprint": "4324cbc9274c4ff5e2c9bd352782f10bcfc140a446a95a9b9fea4e2024c27de6",
      "outlineStructureFingerprint": "a81074a4a2ad3b4006ab5893bac2460f11f73fd430b79ed5e121f98416659d61"
    }
  ],
  "T2.05": [
    {
      "path": "T2.05 SGBD/T2.05 SGBD - Temario.pdf",
      "kind": "syllabus",
      "sha256": "0b059be5a4bca8dc8ecf2dbffd7a73005d58b493c4adb42574533760e755c4a0",
      "outlineFingerprint": "6e15bae5953c7f7eebcdb55abc2f55131b0dfd4619b1e9b04bd2d104957721c3",
      "outlineStructureFingerprint": "87956f4d12d6a60940b018258d522eb3051b37d08156b642cbc90c028bdfa31e"
    }
  ],
  "T3.01": [
    {
      "path": "T3.01 Modelo Entidad-Relación/T3.01 Modelo Entidad-Relación - Temario.pdf",
      "kind": "syllabus",
      "sha256": "8387ad4087fdfbfc2b78acbb97f0fd3b58bb034d732cfa06e5791e4b5ac7785a",
      "outlineFingerprint": "85a1dda584e1c20a51af36c332cd83f93033d06197625b157a802594fedb297b",
      "outlineStructureFingerprint": "d7c025bd9ebfc9f999ce9585f3209cf51f850495a24d84dc8775c4d3de0b5e34"
    }
  ],
  "T3.02": [
    {
      "path": "T3.02 Diseño de BD/T3.02 Diseño de BD - Temario.pdf",
      "kind": "syllabus",
      "sha256": "8e5f7ef02ccdae019b422c205c7a5b774efe690a03dc232069106bce975f3185",
      "outlineFingerprint": "632d9bdf545a8f830efd728057faacc9a9c65b4a7280826214aa769771704c7f",
      "outlineStructureFingerprint": "5533c3ee02da3ea3052d081a10d9ce89b54b71c6f25e040cc70436d62771a73d"
    }
  ],
  "T3.03": [
    {
      "path": "T3.03 Lenguajes de Programación/T3.03 Lenguajes de Programación - Temario.pdf",
      "kind": "syllabus",
      "sha256": "00bd7927476cd6686d692146e80df1a95f13458ea0d083a65527bb1f416b08fb",
      "outlineFingerprint": "47bb743d79a3f03ce24ce89eae7cc077c3fa4b984c95bee9c28ba10cfd1c3434",
      "outlineStructureFingerprint": "2b190dd602c76e9676a859821b99ebaab7131d7580e82ec4de015fef1a1707ea"
    }
  ],
  "T3.04": [
    {
      "path": "T3.04 SQL/T3.04 SQL - Temario.pdf",
      "kind": "syllabus",
      "sha256": "b99989c34d1326722c0dacc4aa425a947c6b8be180a834f2939525a9ccac4b25",
      "outlineFingerprint": "e1ba2f01fb94391ed6d0091f5bb76aeeb1ad6edcfd61f047c52771c3ca6f80a0",
      "outlineStructureFingerprint": "8b850a12986e22c85cabb9217995f42619a50009a4afd9a6cf5c67f50a22d7db"
    }
  ],
  "T3.05": [
    {
      "path": "T3.05 POO/B3T5_POO 1.pdf",
      "kind": "syllabus",
      "sha256": "3f8ff412801c6331558647e7b10cd57d5ed692c44b3121c24f2bbee6d9b28c08",
      "outlineFingerprint": "0298e92b4e64abc180a457ca03043070705ad4837ad0b64affee6a46b3ea5b8e",
      "outlineStructureFingerprint": "087888a8921b1ecbd3edc4f5ceed6dbcd63bfe88d28776f270528439b51d4a59"
    }
  ],
  "T3.06": [
    {
      "path": "T3.06 Java y .NET/T3.06 Java y .NET - Resumen - C plus.pdf",
      "kind": "review",
      "sha256": "9243bafe5bb5be43ae4e14d28154cbad8fe5c110587560fbd782438e41abf0ff",
      "outlineFingerprint": "c5b9b11a9a18090487d0c383fe76c6154f107f1f5d914d548530269da37c83c1",
      "outlineStructureFingerprint": "cbcd99468bd2bae2ee0cbce42a2d48282020fd0f4a776c857eb409caa5bda4dc"
    },
    {
      "path": "T3.06 Java y .NET/T3.06 Java y .NET - Resumen - C sharp.pdf",
      "kind": "review",
      "sha256": "563da7491d1e448f1e37bd58ed145ff1c6dd9539c9abb619e203ef333b593d78",
      "outlineFingerprint": "e70a328903693275a978c94097d979e03a298802363d0e568df978dcd399621f",
      "outlineStructureFingerprint": "182aab740a1434ed76888d3ae5f24d3815a3f4efb7eac108baba29742019c02c"
    },
    {
      "path": "T3.06 Java y .NET/T3.06 Java y .NET - Resumen - C.pdf",
      "kind": "review",
      "sha256": "359e9ca003f4a0387feb698e2c497fe74de966f9164c4c9932a4fae1b64b5618",
      "outlineFingerprint": "3c92e980eba0b7cec3561083385cfb73f8fa95a1f60f16098d47510ce4c4fef1",
      "outlineStructureFingerprint": "b78232dbd03f2ff803092ecc934bccd4e69bfe27530767177d11b4815e4b169d"
    },
    {
      "path": "T3.06 Java y .NET/T3.06 Java y .NET - Resumen - Java y .NET subrayado.pdf",
      "kind": "review",
      "sha256": "958fd595e8074cf619116c4662a21e86ff492f6f46cc077292171661df440e8b",
      "outlineFingerprint": "fcaab4029357777fd6d3e3ed2af47dcba890ce8af3848bb7ad378ebe8c4118b1",
      "outlineStructureFingerprint": "bdea284ed760e86a919d516e0b1a12438ec2367d2ddf730de2d66ebe2f2ba763"
    },
    {
      "path": "T3.06 Java y .NET/T3.06 Java y .NET - Resumen - Java.pdf",
      "kind": "review",
      "sha256": "e483f61444e926dc88182f2ea4f80e72943cb95f626cc55e665cd95b9714b620",
      "outlineFingerprint": "0d2220646137e1f6d3a5b53b8260ecf4f21926581a467acdbc4739f4e164134e",
      "outlineStructureFingerprint": "9b0c3513f27fbbc225f6ea9bdcdde94cb2041b222c23190fe96e012c30a47d93"
    }
  ],
  "T3.07": [
    {
      "path": "T3.07 Arquitectura de Sistemas/T3.07 Arquitectura de Sistemas - Temario.pdf",
      "kind": "syllabus",
      "sha256": "7ac226eb1c711e5def0166d08552f5c6c9fc667b531fdc470250337c024136c0",
      "outlineFingerprint": "2989f27de67e70a3b1b9901f952dd2e755068af55923d2cb32c46dbd4819ac59",
      "outlineStructureFingerprint": "15133bfcc13f3c9506d6f55e03ab0459e7ac90493c80d965e1471f87c9f32d67"
    }
  ],
  "T3.08": [
    {
      "path": "T3.08 Aplicaciones Web/T3.08 Aplicaciones Web - Temario - CSS.pdf",
      "kind": "syllabus",
      "sha256": "f871d3d81529d09b5ee8260e6c78a044df152e0b3a48155f5b54dea41fcf7fee",
      "outlineFingerprint": "c358f2428de64baaea48c3afc32655a6b825143e9bc7402b0b654d1805d45f9c",
      "outlineStructureFingerprint": "872cc401442925ab1bf48fa2d7be955fa6c153f7782b20e9769738660f633e14"
    },
    {
      "path": "T3.08 Aplicaciones Web/T3.08 Aplicaciones Web - Temario - HTML.pdf",
      "kind": "syllabus",
      "sha256": "3481a610ced055ed9c38c313cd78ba950d6219498a7dbf38511046146c7ba5ba",
      "outlineFingerprint": "31704f1a3068d3510da9782b152e907c178db2738b0268d125fdc8dfd47836c4",
      "outlineStructureFingerprint": "98d1614effba1bb49c41c3da0348c217e0e23df9db64fef3a793934013d1f6c7"
    },
    {
      "path": "T3.08 Aplicaciones Web/T3.08 Aplicaciones Web - Temario - JavaScript.pdf",
      "kind": "syllabus",
      "sha256": "1c05b0864e61ae0c2424e1f4d955a400e9260ddce455fba99a0337d56988f8cc",
      "outlineFingerprint": "1d51f18bf1154c8b4d2f814c282e91c0679fcaca9e5e8d66cadf515afbcc0910",
      "outlineStructureFingerprint": "fb3fb181048a2791fec34b3a436dd3ea166a594a3e6610492ef7593070bcb292"
    },
    {
      "path": "T3.08 Aplicaciones Web/T3.08 Aplicaciones Web - Temario - PHP.pdf",
      "kind": "syllabus",
      "sha256": "3db02f45ec04725a28170676ae433e9e5bdcab16a4091f97fba4bade1b1fa5b5",
      "outlineFingerprint": "7faca7e7b35e7e4793a06cf220b211ed166356a882c922d9b4e5342c82c8b065",
      "outlineStructureFingerprint": "0ade77bcd5237a771208fb30fc3b4084a34419149d96c95b55120858f4e338c3"
    },
    {
      "path": "T3.08 Aplicaciones Web/T3.08 Aplicaciones Web - Temario - Python.pdf",
      "kind": "syllabus",
      "sha256": "3c2812e69c47029198d5e8371123b6cd0c0984b4ca73c41e93a229534521969b",
      "outlineFingerprint": "2a08b8115d53c9eb595056bc8b7e0bde50b722c1323bdd3d3a376c4cd19484df",
      "outlineStructureFingerprint": "b568158e4f7cacf55550f5dc635d84e13173795738a9db59622f0ed5d1f6a89a"
    },
    {
      "path": "T3.08 Aplicaciones Web/T3.08 Aplicaciones Web - Temario - Ruby.pdf",
      "kind": "syllabus",
      "sha256": "fbe6f76b90a113b58fad5c55666315bb3376145e070b352b718cec6fd1d4871f",
      "outlineFingerprint": "7616add39ef067f814479c285813a2e6e2f437560776a6cef0c00c6aafa7fe0f",
      "outlineStructureFingerprint": "ab66a7b9a58b81c4773f00d5445175e97f9fdd227694677d93241a9747d8677b"
    },
    {
      "path": "T3.08 Aplicaciones Web/T3.08 Aplicaciones Web - Temario.pdf",
      "kind": "syllabus",
      "sha256": "980aaf92d3f84a4a632d5324ef15fde8d6ce8c71f385ec2a57fb3d806c9c0bc5",
      "outlineFingerprint": "4603476b57cedb14c38fd4d8f543abf0bcdc44f81c07d8f6da372e29ebf1a1e6",
      "outlineStructureFingerprint": "a4d6c34de457aa07bf64a9644d7a08950c4dfd7ab4b3d20e2a621b3314364c89"
    }
  ],
  "T3.09": [
    {
      "path": "T3.09 Accesibilidad y Seguridad/T3.09 Accesibilidad y Seguridad - Temario.pdf",
      "kind": "syllabus",
      "sha256": "0539d2f33ba827890a48a438cbb574e3beddf60dbff135d65bdf023737471146",
      "outlineFingerprint": "3b140fcf1ce9460d6c8eb8691041494a2c7682eebbedb50bd4f95ab19bf811ac",
      "outlineStructureFingerprint": "b828fb185c05d5bb3515304e501dae4b1b3633178bc586b79b4767c8e1d4e354"
    }
  ],
  "T3.10": [
    {
      "path": "T3.10 Metodologías de Pruebas y Colaboración/T3.10 Metodologías de Pruebas y Colaboración - Temario.pdf",
      "kind": "syllabus",
      "sha256": "68ea4f2bd2e450d418b4e0faecb0c0ffe9c7aaab298218252925dbf6445e8581",
      "outlineFingerprint": "e3fb52939feb2235837cc8e315a9e021a3de761cc691c88d57c543d8efd38093",
      "outlineStructureFingerprint": "dad1ab0ffeefccf7d8007840aa07e4c8ab4916283bc7f9a1d5981eb0d2314ea1"
    }
  ],
  "T4.01": [
    {
      "path": "T4.01 Administración de SO/T4.01 Administración de SO - Temario (version alternativa).pdf",
      "kind": "syllabus",
      "sha256": "f7c99562cca2c5d2b7923505c7faced04877e46def902faa38faa149ea2c575e",
      "outlineFingerprint": "3efa8c4f8d7741b3750356fa91863f7d655a48079752af02b4959fa493c520f5",
      "outlineStructureFingerprint": "7b52f636b797a10f2e44df6bda839217be63acb4f6bbb73236a3633c4f1093e9"
    }
  ],
  "T4.02": [
    {
      "path": "T4.02 Administración de BD y Virtualización/T4.02 Administración de BD y Virtualización - Temario.pdf",
      "kind": "syllabus",
      "sha256": "27e64d9f792c38d63afe91f3e887bebbd9c7c5ea85f0fdc06ee93a6a59fcf64f",
      "outlineFingerprint": "8f9d8949113629b211075ef52f29007a69d494b9fe7f63119d03532cc7306d25",
      "outlineStructureFingerprint": "587c270bc23bb2f29d781a518115c0b4d3f5aec22983c4877980a371e66b3059"
    }
  ],
  "T4.03": [
    {
      "path": "T4.03 Administración del Correo/T4.03 Administración del Correo - Temario.pdf",
      "kind": "syllabus",
      "sha256": "db3cd01ac360f546a252c040fb97b6b436bee4809c5255b610b8a43d6f1f6bee",
      "outlineFingerprint": "47127eea8c380fb9e426aeea088a1331ee4b23847ab2a65a483be373011b7c08",
      "outlineStructureFingerprint": "c0da6a2c330d92f5c8ffd376d8e3e63fe2724566d796a1754225827ae7ff9969"
    }
  ],
  "T4.04": [
    {
      "path": "T4.04 Administración de LAN/T4.04 Administración de LAN - Temario.pdf",
      "kind": "syllabus",
      "sha256": "062ceb78c62611a4fc191ef019d6b923c902de774f9f0a29ee933c808c8944c0",
      "outlineFingerprint": "ce5bad1f772607b2d4abc3492e430046ce3d6e5a9612447634b5b32567b30501",
      "outlineStructureFingerprint": "1eb6bd24d2bcabb3641a4537c8277cf9a7a850a91c92da229f30b9903beb70a6"
    }
  ],
  "T4.05": [
    {
      "path": "T4.05 Seguridad CPD y Criptografía/T4.05 Seguridad CPD y Criptografía - Temario.pdf",
      "kind": "syllabus",
      "sha256": "651e698d631c33ee56df99873bbcfd57e39f7657b98de298b10b989d42a023db",
      "outlineFingerprint": "d8a6a1fda189d0054a4788de3510feb0c02ec9cd129d6500c7e819797d4509c0",
      "outlineStructureFingerprint": "5d032a5e50462eb85d4097b3b479825dd023d89dfad5a19959bf30dac15ff250"
    }
  ],
  "T4.06": [
    {
      "path": "T4.06 Comunicaciones y Redes/T4.06 Comunicaciones y Redes - Temario.pdf",
      "kind": "syllabus",
      "sha256": "cc73bc044bdfdb53d6c6776f87a79f0fe690f1c5c1a2ee9c4749bb98f9bcf3eb",
      "outlineFingerprint": "bd87026a190c9000b37938ecf3237366209c170f54ef67dbcc54545a86f1ac07",
      "outlineStructureFingerprint": "3c3d7f2438d7a98691a64d5ccc15ffd9f84c63a7609d9243f447d737185a041c"
    }
  ],
  "T4.07": [
    {
      "path": "T4.07 Modelo TCP y OSI/T4.07 Modelo TCP y OSI - Temario.pdf",
      "kind": "syllabus",
      "sha256": "8c96987feee2c1ddade9129a46a22faf3166f37a58524261b7ec3818e5f1fb58",
      "outlineFingerprint": "a0cbcd61c19a7aa8a0c557757757f622843edbb171be5e76d70fa6fd36a1a52a",
      "outlineStructureFingerprint": "4f60bb356285d0e05df2b8e3e9bd25744b3209e0429c0b1873535eac2bde938f"
    }
  ],
  "T4.08": [
    {
      "path": "T4.08 Internet/T4.08 Internet - Temario.pdf",
      "kind": "syllabus",
      "sha256": "2a460897d6652d005ebb5160190b24a80d3bdfa9b16cd61bca16bba5b7688060",
      "outlineFingerprint": "8de20f13bad5fb0dc16481c5bb5a35c96ca7b0e80a40f6fd7dfc72558dc81135",
      "outlineStructureFingerprint": "3660a4bde239e741a65031f08a6846e07fb32676f4bc0e47e58c430d10fb93ef"
    }
  ],
  "T4.09": [
    {
      "path": "T4.09 Seguridad en Redes/T4.09 Seguridad en Redes - Temario.pdf",
      "kind": "syllabus",
      "sha256": "38ebb19d13455c4a1570159b22f6b3a550d7920fd21bbb519f76c7b1d9fb52c1",
      "outlineFingerprint": "f19cda0043d5a9e05aef6d4e3e882dcfbf4af40ac19d5f3f85334d2e4a784289",
      "outlineStructureFingerprint": "b8b3d36fa68a14cccf8c1b92bf95af38509c4f584e9652cd42e7cacd79b192ca"
    }
  ],
  "T4.10": [
    {
      "path": "T4.10 Redes Locales/T4.10 Redes Locales - Temario.pdf",
      "kind": "syllabus",
      "sha256": "7a360f7f2f0279b47691155a5cdda67a5394114a70718a162878ac4414c8a710",
      "outlineFingerprint": "86d199cfb8da58c5905dd268682b255b96adae308bd836db6f80af2183d35a63",
      "outlineStructureFingerprint": "d892d548005b0107f833982af045f9df9174c3dcd8f6a7679b372c3bb1355f29"
    }
  ]
};
