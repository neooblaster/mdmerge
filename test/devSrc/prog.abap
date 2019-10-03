  METHOD _addsegment_ze1edp01.
    DATA: lv_meinh_ucs  TYPE marm-meinh,
          lv_meinh_ucv  TYPE marm-meinh,
          lv_ekes_ebtyp TYPE ekes-ebtyp,
          lv_ebelp      TYPE ebelp,
          lv_atinn      TYPE atinn,
          ls_ze1edp01   TYPE ze1edp01.

    FIELD-SYMBOLS: <ls_customization> TYPE zcorxf000t_01.

    CLEAR: ls_ze1edp01.

    READ TABLE gt_customization ASSIGNING <ls_customization> WITH KEY zcode   = 'SIPI01'
                                                                      zdomain = 'MM'
                                                                      zdata   = 'MEINH'
                                                                      zinput1 = 'UCS' BINARY SEARCH.
    IF sy-subrc = 0.
      lv_meinh_ucs = <ls_customization>-zoutput1.
    ENDIF.

    READ TABLE gt_customization ASSIGNING <ls_customization> WITH KEY zcode   = 'SIPI01'
                                                                      zdomain = 'MM'
                                                                      zdata   = 'MEINH'
                                                                      zinput1 = 'UCV' BINARY SEARCH.
    IF sy-subrc = 0.
      lv_meinh_ucv = <ls_customization>-zoutput1.
    ENDIF.

    READ TABLE gt_customization ASSIGNING <ls_customization> WITH KEY zcode   = 'SIPI01'
                                                                      zdomain = 'MM'
                                                                      zdata   = 'EKES_EBTYP' BINARY SEARCH.
    IF sy-subrc = 0.
      lv_ekes_ebtyp = <ls_customization>-zoutput1.
    ENDIF.


    lv_ebelp = is_e1edp01-posex.

    "--- bednr, xchar, prdha, mtart, elikz, untto, uebto and loekz  fields --
    READ TABLE it_ekpo ASSIGNING FIELD-SYMBOL(<ls_ekpo>) WITH KEY ebeln = is_ekko-ebeln
                                                                  ebelp = lv_ebelp.
    IF sy-subrc = 0.

      "--- ucs field --
      SELECT SINGLE mara~matnr,
                    mara~prdha,
                    mara~zzcapacityfamily,
                    marc~xchar,
                    mara~laeng,                     " Length         (+) v7 DUPRENI, 20.05.2019
                    mara~breit,                     " Width          (+) v7 DUPRENI, 20.05.2019
                    mara~hoehe,                     " Height         (+) v7 DUPRENI, 20.05.2019
                    mara~volum,                     " Volum          (+) v7 DUPRENI, 20.05.2019
                    mara~brgew                      " Gross weight   (+) v7 DUPRENI, 20.05.2019
        FROM marc
        INNER JOIN mara ON marc~matnr = mara~matnr
        WHERE marc~matnr = @<ls_ekpo>-matnr
          AND marc~werks = @<ls_ekpo>-werks
        INTO @DATA(ls_marc).

      "--- ucs field --
      SELECT SINGLE umrez
        FROM marm
        WHERE matnr = @<ls_ekpo>-matnr
          AND meinh = @lv_meinh_ucs
        INTO @DATA(lv_ucs).
      IF sy-subrc = 0.
        ls_ze1edp01-ucs = lv_ucs.
      ENDIF.

      "--- ucv field --
      SELECT SINGLE umrez
        FROM marm
        WHERE matnr = @<ls_ekpo>-matnr
          AND meinh = @lv_meinh_ucv
        INTO @DATA(lv_ucv).
      IF sy-subrc = 0.
        ls_ze1edp01-ucv = lv_ucv.
      ENDIF.


      ls_ze1edp01-bednr      = <ls_ekpo>-bednr.
      ls_ze1edp01-xchar      = ls_marc-xchar.
      ls_ze1edp01-prdha      = ls_marc-prdha.
      ls_ze1edp01-mtart      = <ls_ekpo>-mtart.
      ls_ze1edp01-elikz      = <ls_ekpo>-elikz.
      ls_ze1edp01-untto      = <ls_ekpo>-untto.
      ls_ze1edp01-uebto      = <ls_ekpo>-uebto.
      ls_ze1edp01-loekz      = <ls_ekpo>-loekz.
      ls_ze1edp01-laeng      = ls_marc-laeng.       " Length         (+) v7 DUPRENI, 20.05.2019
      ls_ze1edp01-breit      = ls_marc-breit.       " Width          (+) v7 DUPRENI, 20.05.2019
      ls_ze1edp01-hoehe      = ls_marc-hoehe.       " Height         (+) v7 DUPRENI, 20.05.2019
      ls_ze1edp01-volum      = ls_marc-volum.       " Volum          (+) v7 DUPRENI, 20.05.2019
      ls_ze1edp01-brgew      = ls_marc-brgew.       " Gross weight   (+) v7 DUPRENI, 20.05.2019

      "--- name1 and j_1kfrepre fields --
      IF <ls_ekpo>-emlif IS NOT INITIAL.
        SELECT SINGLE name1,
                      j_1kfrepre
          FROM lfa1
          WHERE lifnr = @<ls_ekpo>-emlif
          INTO ( @ls_ze1edp01-name1, @ls_ze1edp01-j_1kfrepre ).
      ENDIF.

      "--- confirm flag
      SELECT etens
        FROM ekes
        WHERE ebeln = @gs_e1edk01-belnr
          AND ebelp = @is_e1edp01-posex
          AND ebtyp = @lv_ekes_ebtyp
        INTO TABLE @DATA(lt_ekes).
      IF sy-subrc = 0 AND lt_ekes IS NOT INITIAL.
        ls_ze1edp01-confirm = abap_true.
      ENDIF.


      "--- PEROPACK field --- (+) v7 DUPRENI 20.05.2019
      IF is_ekko-bsart       EQ 'ZPNE'      AND
         ls_ze1edp01-laeng   IS NOT INITIAL AND
         ls_ze1edp01-breit   IS NOT INITIAL AND
         ls_ze1edp01-hoehe   IS NOT INITIAL AND
         ls_ze1edp01-volum   IS NOT INITIAL AND
         ls_ze1edp01-brgew   IS NOT INITIAL.
        ls_ze1edp01-persopack = 'X'.
      ENDIF.
      "                       Fin addition DUPRENI



      " CAPACITY_FAMILY characteristic
*      IF ls_marc-zzcapacityfamily IS NOT INITIAL.                                                                         " (-) 13.02.2019 v6 : retrieve code only
*        CLEAR: ls_ze1edp01-cap_family.                                                                                    " (-) 13.02.2019 v6 : retrieve code only
*        " Select description                                                                                              " (-) 13.02.2019 v6 : retrieve code only
*        SELECT langu,                                                                                                     " (-) 13.02.2019 v6 : retrieve code only
*               vtext                                                                                                      " (-) 13.02.2019 v6 : retrieve code only
*          FROM zcormm_capafamil                                                                                           " (-) 13.02.2019 v6 : retrieve code only
*          WHERE zzcapacityfamily = @ls_marc-zzcapacityfamily                                                              " (-) 13.02.2019 v6 : retrieve code only
*          INTO TABLE @DATA(lt_zcormm_capafamil).                                                                          " (-) 13.02.2019 v6 : retrieve code only
*        IF sy-subrc = 0.                                                                                                  " (-) 13.02.2019 v6 : retrieve code only
*          SORT lt_zcormm_capafamil BY langu.                                                                              " (-) 13.02.2019 v6 : retrieve code only
*                                                                                                                          " (-) 13.02.2019 v6 : retrieve code only
*          READ TABLE lt_zcormm_capafamil ASSIGNING FIELD-SYMBOL(<ls_zzcapacity>) WITH KEY langu = is_ekko-spras           " (-) 13.02.2019 v6 : retrieve code only
*          BINARY SEARCH.                                                                                                  " (-) 13.02.2019 v6 : retrieve code only
*          IF sy-subrc = 0.                                                                                                " (-) 13.02.2019 v6 : retrieve code only
*            IF <ls_zzcapacity>-vtext IS NOT INITIAL.                                                                      " (-) 13.02.2019 v6 : retrieve code only
*              ls_ze1edp01-cap_family = <ls_zzcapacity>-vtext.                                                             " (-) 13.02.2019 v6 : retrieve code only
*            ENDIF.                                                                                                        " (-) 13.02.2019 v6 : retrieve code only
*          ENDIF.                                                                                                          " (-) 13.02.2019 v6 : retrieve code only
*                                                                                                                          " (-) 13.02.2019 v6 : retrieve code only
*          IF ls_ze1edp01-cap_family IS INITIAL.                                                                           " (-) 13.02.2019 v6 : retrieve code only
*            READ TABLE lt_zcormm_capafamil ASSIGNING <ls_zzcapacity> WITH KEY langu = sy-langu                            " (-) 13.02.2019 v6 : retrieve code only
*            BINARY SEARCH.                                                                                                " (-) 13.02.2019 v6 : retrieve code only
*            IF sy-subrc = 0.                                                                                              " (-) 13.02.2019 v6 : retrieve code only
*              IF <ls_zzcapacity>-vtext IS NOT INITIAL.                                                                    " (-) 13.02.2019 v6 : retrieve code only
*                ls_ze1edp01-cap_family = <ls_zzcapacity>-vtext.                                                           " (-) 13.02.2019 v6 : retrieve code only
*              ENDIF.                                                                                                      " (-) 13.02.2019 v6 : retrieve code only
*            ENDIF.                                                                                                        " (-) 13.02.2019 v6 : retrieve code only
*          ENDIF.                                                                                                          " (-) 13.02.2019 v6 : retrieve code only
*                                                                                                                          " (-) 13.02.2019 v6 : retrieve code only
*          IF ls_ze1edp01-cap_family IS INITIAL.                                                                           " (-) 13.02.2019 v6 : retrieve code only
*            READ TABLE lt_zcormm_capafamil ASSIGNING <ls_zzcapacity> INDEX 1.                                             " (-) 13.02.2019 v6 : retrieve code only
*            IF sy-subrc = 0.                                                                                              " (-) 13.02.2019 v6 : retrieve code only
*              IF <ls_zzcapacity>-vtext IS NOT INITIAL.                                                                    " (-) 13.02.2019 v6 : retrieve code only
*                ls_ze1edp01-cap_family = <ls_zzcapacity>-vtext.                                                           " (-) 13.02.2019 v6 : retrieve code only
*              ENDIF.                                                                                                      " (-) 13.02.2019 v6 : retrieve code only
*            ENDIF.                                                                                                        " (-) 13.02.2019 v6 : retrieve code only
*          ENDIF.                                                                                                          " (-) 13.02.2019 v6 : retrieve code only
*
*        ENDIF.
*      ENDIF.


*      IF ls_ze1edp01-cap_family IS INITIAL.                                                                               " (-) 13.02.2019 v6 : retrieve code only
      " initialize value with code
      ls_ze1edp01-cap_family = ls_marc-zzcapacityfamily.
*      ENDIF.                                                                                                              " (-) 13.02.2019 v6 : retrieve code only

*      CALL FUNCTION 'CONVERSION_EXIT_ATINN_INPUT'                                                                         " (-) 30.01.2019: retrieve from ZZ field in MARA
*        EXPORTING                                                                                                         " (-) 30.01.2019: retrieve from ZZ field in MARA
*          input  = 'CAPACITY_FAMILY'                                                                                      " (-) 30.01.2019: retrieve from ZZ field in MARA
*        IMPORTING                                                                                                         " (-) 30.01.2019: retrieve from ZZ field in MARA
*          output = lv_atinn.                                                                                              " (-) 30.01.2019: retrieve from ZZ field in MARA
*                                                                                                                          " (-) 30.01.2019: retrieve from ZZ field in MARA
*      IF lv_atinn IS NOT INITIAL.                                                                                         " (-) 30.01.2019: retrieve from ZZ field in MARA
*        SELECT cawnt~atwtb,                                                                                               " (-) 30.01.2019: retrieve from ZZ field in MARA
*               cawnt~spras,                                                                                               " (-) 30.01.2019: retrieve from ZZ field in MARA
*               ausp~atwrt                                                                                                 " (-) 30.01.2019: retrieve from ZZ field in MARA
*          FROM ausp INNER JOIN ( cawn                                                                                     " (-) 30.01.2019: retrieve from ZZ field in MARA
*                                  INNER JOIN cawnt ON  cawnt~atinn = cawn~atinn                                           " (-) 30.01.2019: retrieve from ZZ field in MARA
*                                                   AND cawnt~atzhl = cawn~atzhl ) ON  cawn~atinn = ausp~atinn             " (-) 30.01.2019: retrieve from ZZ field in MARA
*                                                                                 AND cawn~adzhl = '0000'                  " (-) 30.01.2019: retrieve from ZZ field in MARA
*                                                                                 AND cawn~atwrt = ausp~atwrt              " (-) 30.01.2019: retrieve from ZZ field in MARA
*          WHERE ausp~objek = @<ls_ekpo>-matnr                                                                             " (-) 30.01.2019: retrieve from ZZ field in MARA
*          AND ausp~klart = '001'                                                                                          " (-) 30.01.2019: retrieve from ZZ field in MARA
*          AND ausp~atinn = @lv_atinn                                                                                      " (-) 30.01.2019: retrieve from ZZ field in MARA
*          AND ausp~mafid = 'O'                                                                                            " (-) 30.01.2019: retrieve from ZZ field in MARA
*          AND ausp~adzhl = '0000'                                                                                         " (-) 30.01.2019: retrieve from ZZ field in MARA
*          INTO TABLE @DATA(lt_cawnt).                                                                                     " (-) 30.01.2019: retrieve from ZZ field in MARA
*        IF sy-subrc = 0.                                                                                                  " (-) 30.01.2019: retrieve from ZZ field in MARA
*          SORT lt_cawnt BY spras.                                                                                         " (-) 30.01.2019: retrieve from ZZ field in MARA
*          READ TABLE lt_cawnt ASSIGNING FIELD-SYMBOL(<ls_cawnt>) WITH KEY spras = sy-langu BINARY SEARCH.                 " (-) 30.01.2019: retrieve from ZZ field in MARA
*          IF sy-subrc = 0.                                                                                                " (-) 30.01.2019: retrieve from ZZ field in MARA
*            ls_ze1edp01-cap_family = <ls_cawnt>-atwtb.                                                                    " (-) 30.01.2019: retrieve from ZZ field in MARA
*          ELSE.                                                                                                           " (-) 30.01.2019: retrieve from ZZ field in MARA
*            READ TABLE lt_cawnt ASSIGNING <ls_cawnt> INDEX 1.                                                             " (-) 30.01.2019: retrieve from ZZ field in MARA
*            IF sy-subrc = 0.                                                                                              " (-) 30.01.2019: retrieve from ZZ field in MARA
*              ls_ze1edp01-cap_family = <ls_cawnt>-atwrt.                                                                  " (-) 30.01.2019: retrieve from ZZ field in MARA
*            ENDIF.                                                                                                        " (-) 30.01.2019: retrieve from ZZ field in MARA
*          ENDIF.                                                                                                          " (-) 30.01.2019: retrieve from ZZ field in MARA
*                                                                                                                          " (-) 30.01.2019: retrieve from ZZ field in MARA
*        ENDIF.                                                                                                            " (-) 30.01.2019: retrieve from ZZ field in MARA
*      ENDIF.

    ENDIF.

    IF ls_ze1edp01 IS NOT INITIAL.
      APPEND INITIAL LINE TO ct_int_edidd ASSIGNING FIELD-SYMBOL(<ls_new_edidd>).
      <ls_new_edidd>-segnam = 'ZE1EDP01'.
      cl_abap_container_utilities=>fill_container_c(
        EXPORTING
          im_value               =  ls_ze1edp01   " Data for Filling Container
        IMPORTING
          ex_container           = <ls_new_edidd>-sdata    " Container
        EXCEPTIONS
          illegal_parameter_type = 1
          OTHERS                 = 2
      ).
    ENDIF.


  ENDMETHOD.