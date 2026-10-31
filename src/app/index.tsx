import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const STORAGE_KEY = '@producao/apontamentos-v1';
const PONTOS = [
  'Top Mont 1',
  'Top Mont 2',
  'Top Mont 3',
  'Honda',
  'Tapete',
  'Descarregado',
  'Embalagem',
] as const;

type Ponto = (typeof PONTOS)[number];
type Turno = '1' | '2' | '3';
type Quantidades = Record<Ponto, number>;
type MetasDoDia = Record<Turno, number>;

type Registro = {
  id: string;
  nome: string;
  chapa: string;
  turno: Turno;
  data: string;
  hora: string;
  quantidades: Quantidades;
  justificativa: string;
};

type DadosSalvos = {
  registros: Registro[];
  metasPorData: Record<string, MetasDoDia>;
};

const criarQuantidadesTexto = (): Record<Ponto, string> =>
  Object.fromEntries(PONTOS.map((ponto) => [ponto, '0'])) as Record<Ponto, string>;

const metasVazias = (): MetasDoDia => ({ '1': 0, '2': 0, '3': 0 });

function dataISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function dataDoDia(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

function exibirData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatar(numero: number): string {
  return new Intl.NumberFormat('pt-BR').format(numero);
}

export default function HomeScreen() {
  const [nome, setNome] = useState('');
  const [chapa, setChapa] = useState('');
  const [turno, setTurno] = useState<Turno>('1');
  const [dataSelecionada, setDataSelecionada] = useState(dataISO(new Date()));
  const [mostrarData, setMostrarData] = useState(false);
  const [quantidadesTexto, setQuantidadesTexto] = useState(criarQuantidadesTexto());
  const [justificativa, setJustificativa] = useState('');
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [metasPorData, setMetasPorData] = useState<Record<string, MetasDoDia>>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    async function carregarDados() {
      try {
        const conteudo = await AsyncStorage.getItem(STORAGE_KEY);
        if (conteudo) {
          const dados = JSON.parse(conteudo) as Partial<DadosSalvos>;
          setRegistros(Array.isArray(dados.registros) ? dados.registros : []);
          setMetasPorData(
            dados.metasPorData && typeof dados.metasPorData === 'object'
              ? dados.metasPorData
              : {},
          );
        }
      } catch {
        Alert.alert('Aviso', 'Não foi possível carregar os dados salvos no aparelho.');
      } finally {
        setCarregado(true);
      }
    }
    carregarDados();
  }, []);

  useEffect(() => {
    if (!carregado) return;
    const dados: DadosSalvos = { registros, metasPorData };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dados)).catch(() => {
      Alert.alert('Erro', 'Não foi possível salvar os dados no aparelho.');
    });
  }, [registros, metasPorData, carregado]);

  const registrosDoDia = useMemo(
    () => registros.filter((registro) => registro.data === dataSelecionada),
    [registros, dataSelecionada],
  );

  const producaoPorTurno = useMemo(() => {
    const totais: MetasDoDia = metasVazias();
    registrosDoDia.forEach((registro) => {
      totais[registro.turno] += Object.values(registro.quantidades).reduce(
        (soma, quantidade) => soma + quantidade,
        0,
      );
    });
    return totais;
  }, [registrosDoDia]);

  const producaoPorPontoETurno = useMemo(() => {
    const totais = Object.fromEntries(
      PONTOS.map((ponto) => [ponto, { '1': 0, '2': 0, '3': 0 }]),
    ) as Record<Ponto, MetasDoDia>;

    registrosDoDia.forEach((registro) => {
      PONTOS.forEach((ponto) => {
        totais[ponto][registro.turno] += registro.quantidades[ponto] || 0;
      });
    });
    return totais;
  }, [registrosDoDia]);

  const metasHoje = metasPorData[dataSelecionada] ?? metasVazias();
  const totalGeral = producaoPorTurno['1'] + producaoPorTurno['2'] + producaoPorTurno['3'];

  function atualizarMeta(turnoMeta: Turno, texto: string) {
    if (texto !== '' && !/^\d+$/.test(texto)) return;
    const valor = Number(texto || 0);
    setMetasPorData((atuais) => ({
      ...atuais,
      [dataSelecionada]: {
        ...(atuais[dataSelecionada] ?? metasVazias()),
        [turnoMeta]: valor,
      },
    }));
  }

  function salvarApontamento() {
    if (!nome.trim() || !chapa.trim()) {
      Alert.alert('Dados obrigatórios', 'Preencha o nome e a chapa.');
      return;
    }

    const quantidades = {} as Quantidades;
    for (const ponto of PONTOS) {
      const texto = quantidadesTexto[ponto].trim();
      if (!/^\d+$/.test(texto)) {
        Alert.alert('Quantidade inválida', `Informe um número inteiro igual ou maior que zero para ${ponto}.`);
        return;
      }
      quantidades[ponto] = Number(texto);
    }

    if (Object.values(quantidades).every((quantidade) => quantidade === 0)) {
      Alert.alert('Sem produção', 'Informe uma quantidade maior que zero em pelo menos um ponto.');
      return;
    }

    const agora = new Date();
    const registro: Registro = {
      id: `${agora.getTime()}-${Math.random().toString(16).slice(2)}`,
      nome: nome.trim(),
      chapa: chapa.trim(),
      turno,
      data: dataSelecionada,
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      quantidades,
      justificativa: justificativa.trim(),
    };

    setRegistros((atuais) => [registro, ...atuais]);
    setQuantidadesTexto(criarQuantidadesTexto());
    setJustificativa('');
    Alert.alert('Apontamento salvo', `Registro do Turno ${turno} salvo neste aparelho.`);
  }

  function renderMeta(turnoMeta: Turno) {
    const meta = metasHoje[turnoMeta] || 0;
    const produzido = producaoPorTurno[turnoMeta] || 0;
    const falta = meta - produzido;

    let mensagem = 'Defina a meta diária deste turno.';
    if (meta > 0 && falta > 0) mensagem = `Faltam ${formatar(falta)} peças`;
    if (meta > 0 && falta === 0) mensagem = 'Meta atingida';
    if (meta > 0 && falta < 0) mensagem = `Meta superada em ${formatar(Math.abs(falta))} peças`;

    const progresso = meta > 0 ? Math.min(100, Math.round((produzido / meta) * 100)) : 0;

    return (
      <View style={styles.metaCartao} key={turnoMeta}>
        <View style={styles.linhaEntre}>
          <Text style={styles.nomePonto}>Turno {turnoMeta}</Text>
          <Text style={styles.numeroTurno}>{formatar(produzido)} peças</Text>
        </View>
        <View style={styles.linhaMeta}>
          <Text style={styles.textoMeta}>Meta do dia</Text>
          <TextInput
            style={styles.campoMeta}
            value={meta > 0 ? String(meta) : ''}
            onChangeText={(texto) => atualizarMeta(turnoMeta, texto)}
            keyboardType="number-pad"
            placeholder="Definir"
            accessibilityLabel={`Meta diária do turno ${turnoMeta}`}
          />
          <Text style={styles.textoMeta}>peças</Text>
        </View>
        <Text style={styles.statusMeta}>{mensagem}</Text>
        <View style={styles.trilhoProgresso}>
          <View style={[styles.progresso, { width: `${progresso}%` }]} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.sobretitulo}>CONTROLE DE FÁBRICA</Text>
      <Text style={styles.titulo}>Produção</Text>
      <Text style={styles.subtitulo}>Apontamento por turno · {exibirData(dataSelecionada)}</Text>

      <View style={styles.cartaoResumo}>
        <Text style={styles.rotuloResumo}>TOTAL GERAL DO DIA</Text>
        <Text style={styles.totalGeral}>{formatar(totalGeral)} peças</Text>
      </View>

      <View style={styles.cartao}>
        <Text style={styles.tituloSecao}>Metas e produção dos turnos</Text>
        {(['1', '2', '3'] as const).map(renderMeta)}
      </View>

      <View style={styles.cartao}>
        <Text style={styles.tituloSecao}>Identificação do apontamento</Text>
        <Text style={styles.rotulo}>NOME</Text>
        <TextInput
          style={styles.campo}
          value={nome}
          onChangeText={setNome}
          placeholder="Nome de quem está apontando"
          maxLength={80}
          autoCapitalize="words"
        />

        <Text style={styles.rotulo}>CHAPA</Text>
        <TextInput
          style={styles.campo}
          value={chapa}
          onChangeText={setChapa}
          placeholder="Número da chapa"
          maxLength={30}
        />

        <Text style={styles.rotulo}>TURNO</Text>
        <View style={styles.seletor}>
          <Picker selectedValue={turno} onValueChange={(valor: Turno) => setTurno(valor)}>
            <Picker.Item label="Turno 1" value="1" />
            <Picker.Item label="Turno 2" value="2" />
            <Picker.Item label="Turno 3" value="3" />
          </Picker>
        </View>

        <Text style={styles.rotulo}>DATA DA PRODUÇÃO</Text>
        <Pressable style={styles.campoData} onPress={() => setMostrarData(true)}>
          <Text style={styles.textoCampo}>{exibirData(dataSelecionada)} · Toque para alterar</Text>
        </Pressable>
        {mostrarData && (
          <DateTimePicker
            value={dataDoDia(dataSelecionada)}
            mode="date"
            onChange={(_, selecionada) => {
              setMostrarData(false);
              if (selecionada) setDataSelecionada(dataISO(selecionada));
            }}
          />
        )}
      </View>

      <View style={styles.cartao}>
        <Text style={styles.tituloSecao}>Quantidade produzida</Text>
        <Text style={styles.ajuda}>Informe peças inteiras para cada ponto.</Text>
        {PONTOS.map((ponto) => (
          <View style={styles.linhaQuantidade} key={ponto}>
            <Text style={styles.nomePonto}>{ponto}</Text>
            <TextInput
              style={styles.campoQuantidade}
              value={quantidadesTexto[ponto]}
              onChangeText={(texto) => {
                if (texto === '' || /^\d+$/.test(texto)) {
                  setQuantidadesTexto((atuais) => ({ ...atuais, [ponto]: texto }));
                }
              }}
              keyboardType="number-pad"
              placeholder="0"
              accessibilityLabel={`Quantidade ${ponto}`}
            />
          </View>
        ))}

        <Text style={styles.rotulo}>JUSTIFICATIVA (OPCIONAL)</Text>
        <TextInput
          style={[styles.campo, styles.areaTexto]}
          value={justificativa}
          onChangeText={setJustificativa}
          multiline
          maxLength={500}
          placeholder="Ex.: parada de máquina, falta de material ou observação do turno"
          textAlignVertical="top"
        />
        <Text style={styles.ajuda}>Preencha somente quando precisar explicar alguma ocorrência.</Text>

        <Pressable style={styles.botao} onPress={salvarApontamento}>
          <Text style={styles.textoBotao}>Salvar apontamento</Text>
        </Pressable>
      </View>

      <View style={styles.cartao}>
        <Text style={styles.tituloSecao}>Totais por ponto e turno</Text>
        <View style={styles.cabecalhoTabela}>
          <Text style={[styles.celulaPonto, styles.cabecalhoTexto]}>Ponto</Text>
          <Text style={styles.celulaNumero}>T1</Text>
          <Text style={styles.celulaNumero}>T2</Text>
          <Text style={styles.celulaNumero}>T3</Text>
          <Text style={styles.celulaNumero}>Total</Text>
        </View>
        {PONTOS.map((ponto) => {
          const t1 = producaoPorPontoETurno[ponto]['1'];
          const t2 = producaoPorPontoETurno[ponto]['2'];
          const t3 = producaoPorPontoETurno[ponto]['3'];
          return (
            <View style={styles.linhaTabela} key={ponto}>
              <Text style={styles.celulaPonto}>{ponto}</Text>
              <Text style={styles.celulaNumero}>{formatar(t1)}</Text>
              <Text style={styles.celulaNumero}>{formatar(t2)}</Text>
              <Text style={styles.celulaNumero}>{formatar(t3)}</Text>
              <Text style={[styles.celulaNumero, styles.valorTotal]}>{formatar(t1 + t2 + t3)}</Text>
            </View>
          );
        })}
        <View style={styles.linhaTabela}>
          <Text style={[styles.celulaPonto, styles.totalLinha]}>Total</Text>
          {(['1', '2', '3'] as const).map((t) => (
            <Text style={[styles.celulaNumero, styles.totalLinha]} key={t}>
              {formatar(producaoPorTurno[t])}
            </Text>
          ))}
          <Text style={[styles.celulaNumero, styles.valorTotal, styles.totalLinha]}>
            {formatar(totalGeral)}
          </Text>
        </View>
      </View>

      <View style={styles.cartao}>
        <Text style={styles.tituloSecao}>Apontamentos recentes</Text>
        {registrosDoDia.length === 0 ? (
          <Text style={styles.ajuda}>Ainda não há registros para esta data.</Text>
        ) : (
          registrosDoDia.slice(0, 20).map((registro) => {
            const total = Object.values(registro.quantidades).reduce((soma, valor) => soma + valor, 0);
            return (
              <View style={styles.registro} key={registro.id}>
                <Text style={styles.registroTitulo}>
                  {registro.hora} · {registro.nome} · Turno {registro.turno}
                </Text>
                <Text style={styles.ajuda}>
                  Chapa {registro.chapa} · {formatar(total)} peças · {exibirData(registro.data)}
                </Text>
                {registro.justificativa ? (
                  <Text style={styles.ajuda}>Justificativa: {registro.justificativa}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <Text style={styles.rodape}>Versão de teste local · os dados ficam salvos neste aparelho.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f4f7f4' },
  conteudo: { padding: 18, paddingTop: 28, paddingBottom: 48 },
  sobretitulo: { color: '#126b52', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  titulo: { marginTop: 6, color: '#17211d', fontSize: 30, fontWeight: '800' },
  subtitulo: { marginTop: 5, marginBottom: 16, color: '#68756f', fontSize: 13 },
  cartao: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4eae5',
  },
  cartaoResumo: { marginBottom: 14, padding: 16, borderRadius: 16, backgroundColor: '#126b52' },
  rotuloResumo: { color: '#d7eee3', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  totalGeral: { marginTop: 5, color: '#fff', fontSize: 24, fontWeight: '800' },
  tituloSecao: { marginBottom: 12, color: '#17211d', fontSize: 17, fontWeight: '800' },
  rotulo: { marginTop: 12, marginBottom: 5, color: '#65716a', fontSize: 10, fontWeight: '800' },
  campo: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dfe6e0',
    borderRadius: 10,
    color: '#17211d',
    backgroundColor: '#fff',
  },
  campoData: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dfe6e0',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  textoCampo: { color: '#17211d' },
  areaTexto: { minHeight: 84, paddingTop: 10 },
  seletor: { borderWidth: 1, borderColor: '#dfe6e0', borderRadius: 10, overflow: 'hidden' },
  ajuda: { color: '#7b8780', fontSize: 12, lineHeight: 18 },
  linhaQuantidade: {
    minHeight: 49,
    marginTop: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: '#e4eae5',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nomePonto: { color: '#24342b', fontSize: 13, fontWeight: '700' },
  campoQuantidade: {
    width: 90,
    height: 38,
    borderWidth: 1,
    borderColor: '#dfe6e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    textAlign: 'right',
    color: '#17211d',
  },
  botao: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#126b52',
  },
  textoBotao: { color: '#fff', fontSize: 14, fontWeight: '800' },
  metaCartao: { marginBottom: 9, padding: 12, borderRadius: 12, backgroundColor: '#f5f8f5' },
  linhaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  numeroTurno: { color: '#126b52', fontSize: 15, fontWeight: '800' },
  linhaMeta: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  textoMeta: { color: '#68756f', fontSize: 12 },
  campoMeta: {
    width: 96,
    height: 36,
    borderWidth: 1,
    borderColor: '#dfe6e0',
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    textAlign: 'right',
  },
  statusMeta: { marginTop: 8, color: '#126b52', fontSize: 12, fontWeight: '700' },
  trilhoProgresso: { height: 6, marginTop: 7, borderRadius: 99, backgroundColor: '#e4ebe5', overflow: 'hidden' },
  progresso: { height: '100%', borderRadius: 99, backgroundColor: '#75b68c' },
  cabecalhoTabela: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#dfe6e0' },
  linhaTabela: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#edf0ed' },
  cabecalhoTexto: { color: '#718078', fontSize: 10, fontWeight: '800' },
  celulaPonto: { flex: 2.2, color: '#24342b', fontSize: 10, fontWeight: '600' },
  celulaNumero: { flex: 1, textAlign: 'right', color: '#55635b', fontSize: 10 },
  valorTotal: { color: '#126b52', fontWeight: '800' },
  totalLinha: { fontWeight: '800' },
  registro: { marginBottom: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#edf0ed' },
  registroTitulo: { color: '#24342b', fontSize: 13, fontWeight: '800', marginBottom: 3 },
  rodape: { marginTop: 2, marginBottom: 15, color: '#89948d', fontSize: 11, textAlign: 'center' },
});
