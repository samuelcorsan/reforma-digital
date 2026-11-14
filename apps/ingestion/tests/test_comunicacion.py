"""El conversor del análisis de comunicación: de un informe en Markdown a los bloques que pinta la web."""

import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from entrevistas import comunicacion
from entrevistas.comunicacion import leer_informe, momentos_del_informe

INFORME = """# Ficticia en *El Programa*: 3 de 4 preguntas fueron duras

*Análisis de la entrevista (vídeo ficticio).*

De las 4 preguntas, 3 fueron duras.

Un aviso: **nada de esto sirve para saber si alguien dice la verdad**.

## 2. Lo que dicen los datos

| Medida | La invitada | El entrevistador |
|---|---|---|
| Palabras | 100 | 50 |

**Quién corta a quién.** Lo corta dos veces (ver sección 9). (Fotograma en la sección 6.)

![1:05, la invitada](fotogramas/m01.jpg)
*1:05. La invitada.*

## 7. Las preguntas y cómo se responden

### Cómo pregunta

Pregunta corto.

### Temas

| Tema | Minutos | % |
|---|---|---|
| Vivienda | 2,0 | 50 % |

Abre los dos tramos.

### Promesas verificables

Se recogieron 2 compromisos.

## 9. Momentos clave

**1:05 — La cifra.** «son 22» y una pausa.

**Jordi, 2:10 — La repregunta.** «¿sí o no?».

## 11. Lo que este análisis no puede decir

- **Verdad.** Nada de lo medido sirve para saberla.

## 12. Para llevarte a casa

1. **Fue corta.** Cuatro preguntas.

## 13. Fuentes

**Vídeo.** Ficticio.

- Autora, A. (2000). *Un libro*. Editorial.

**Archivos de datos.** `informe.md`.
"""


def test_el_informe_se_reparte_en_las_secciones_de_la_pagina():
    informe = leer_informe(INFORME)
    assert informe["titular"] == "Ficticia en El Programa: 3 de 4 preguntas fueron duras"
    # La línea de créditos no es la entrada.
    assert [texto[:6] for texto in informe["entrada"]] == ["De las", "Un avi"]
    assert informe["claves"] == ["**Fue corta.** Cuatro preguntas."]
    assert informe["limites"] == ["**Verdad.** Nada de lo medido sirve para saberla."]
    assert informe["referencias"] == ["Autora, A. (2000). *Un libro*. Editorial."]
    secciones = informe["secciones"]
    # Los subtítulos de «Las preguntas» van cada uno a su sección, y el que solo la titula sobra.
    assert [b["tipo"] for b in secciones["preguntas"]] == ["parrafo"]
    assert [b["tipo"] for b in secciones["promesas"]] == ["parrafo"]
    # Los minutos por tema los dibuja la página: su tabla no se repite.
    assert [b["tipo"] for b in secciones["temas"]] == ["parrafo"]


def test_no_se_publican_imagenes_y_las_remisiones_enlazan_a_su_seccion():
    habla = leer_informe(INFORME)["secciones"]["habla"]
    assert [b["tipo"] for b in habla] == ["tabla", "parrafo"]
    assert habla[0]["filas"] == [["Palabras", "100", "50"]]
    assert habla[1]["texto"] == "**Quién corta a quién.** Lo corta dos veces (ver [sección «Momentos clave»](#momentos))."


def test_los_momentos_clave_salen_de_las_entradas_del_informe():
    momentos = momentos_del_informe(leer_informe(INFORME)["secciones"]["momentos"])
    assert momentos == [
        {"segundo": 65, "quien": "invitado", "titulo": "La cifra", "cita": "son 22"},
        {"segundo": 130, "quien": "jordi", "titulo": "La repregunta", "cita": "¿sí o no?"},
    ]


def test_el_paquete_de_datos_solo_lleva_lo_publicable(tmp_path, monkeypatch):
    medidas = tmp_path / "medidas"
    medidas.mkdir()
    (medidas / "tonalidad_entrevistado.csv").write_text("inicio,e2v_angry,e2v_categoria,ppm\n1.0,0.9,angry,200\n", encoding="utf-8")
    (medidas / "grafica_voz.png").write_bytes(b"png")
    # Nada de esto se publica: comentarios con nombres, el clasificador de emoción y el vídeo.
    (medidas / "comentarios.csv").write_text("autor,texto\nalguien,hola\n", encoding="utf-8")
    (medidas / "grafica_tonalidad.png").write_bytes(b"png")
    (medidas / "entrevista.mp4").write_bytes(b"mp4")
    monkeypatch.setattr(comunicacion, "PAQUETES", tmp_path / "paquetes")

    datos = comunicacion.empaquetar(medidas, comunicacion.DE_LA_ENTREVISTA, "prueba", "# Léeme")

    with zipfile.ZipFile(tmp_path / "paquetes" / "prueba.zip") as z:
        assert sorted(z.namelist()) == ["prueba/LEEME.md", "prueba/grafica_voz.png", "prueba/tonalidad_entrevistado.csv"]
        assert z.read("prueba/tonalidad_entrevistado.csv").decode("utf-8") == "inicio,ppm\n1.0,200\n"
    assert datos["archivo"] == "prueba.zip" and datos["archivos"] == 3
