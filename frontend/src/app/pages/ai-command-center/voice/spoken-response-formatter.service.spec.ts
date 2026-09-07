import { SpokenResponseFormatterService } from './spoken-response-formatter.service';

describe('SpokenResponseFormatterService',()=>{
  const service=new SpokenResponseFormatterService();
  const table=(priorities:string[])=>'Há ações atrasadas:\n| ID | Ação | Prioridade | Dias atrasada |\n| --- | --- | --- | --- |\n'+priorities.map((priority,i)=>`| ACT-${String(i+1).padStart(4,'0')} | Apply anti-slip treatment to the entire industrial platform | ${priority} | ${75-i} |`).join('\n');
  it('summarizes eight rows with exact priority counts and bounded critical details',()=>{
    const display=table(['High','Medium','Critical','High','Medium','Critical','High','Medium']);
    const result=service.format(display,'pt');
    expect(result.displayResponse).toBe(display);
    expect(result.spokenResponse).toContain('Ações exibidas: 8');
    expect(result.spokenResponse).toContain('Prioridade crítica: 2');
    expect(result.spokenResponse).toContain('Prioridade alta: 3');
    expect(result.spokenResponse).toContain('Prioridade média: 3');
    expect(result.spokenResponse).toContain('ACT-0003, prioridade crítica, 73 dias de atraso');
    expect(result.spokenResponse).toContain('ACT-0006');
    expect(result.spokenResponse).not.toMatch(/ACT-0001|Apply|\||\*\*|---/);
  });
  it('details a single action without reading stored English descriptions',()=>{
    const result=service.format(table(['High']),'pt');
    expect(result.spokenResponse).toContain('ACT-0001, prioridade alta, 75 dias de atraso');
    expect(result.spokenResponse).not.toContain('Apply');
  });
  it('prioritizes high actions when there are no critical actions',()=>{
    const result=service.format(table(['Medium','High','Low','High']),'pt');
    expect(result.spokenResponse).toContain('ACT-0002');
    expect(result.spokenResponse).toContain('ACT-0004');
    expect(result.spokenResponse).not.toContain('ACT-0001');
  });
  it('keeps unknown schemas, JSON, URLs, timestamps and Markdown out of speech',()=>{
    const display='# **Resultado**\n| Projeto | Nome |\n| --- | --- |\n| 1 | English project description |\n```json\n{"id":1}\n```\nhttps://example.com\n2026-09-07T10:30:00Z';
    const result=service.format(display,'pt');
    expect(result.displayResponse).toBe(display);
    expect(result.spokenResponse).not.toMatch(/[|*`#{}]|https|2026|English|Projeto/);
  });
  it('does not infer priority counts from incomplete or duplicate action rows',()=>{
    const result=service.format(table(['unknown']),'pt');
    expect(result.spokenResponse).not.toContain('Prioridade');
    expect(result.spokenResponse).not.toContain('ACT-');
  });
  it('preserves ordinary short responses in every supported language',()=>{
    for(const language of ['pt','en','es','fr','de'] as const) expect(service.format('Resposta simples.',language).spokenResponse).toBe('Resposta simples.');
  });
  it('keeps the detailed display response while shortening a long spoken response',()=>{const display='I found three overdue actions. Gas detector calibration is eight days overdue. '.repeat(5);const result=service.format(display,'en');expect(result.displayResponse).toBe(display);expect(result.spokenResponse.length).toBeLessThan(display.length);expect(result.spokenResponse).toContain('three overdue actions');});
  it('does not invent priority, counts or operational facts',()=>{const result=service.format('Two inspections remain open. '.repeat(15),'en');expect(result.spokenResponse).not.toMatch(/high priority|three|approved/i);expect(result.spokenResponse).toContain('Two inspections');});
  it('removes citation metadata from speech without changing the written answer',()=>{const display='Isolation is required.\nSource: OSHA 1910.147\nVerification: VERIFIED';const result=service.format(display,'en');expect(result.displayResponse).toBe(display);expect(result.spokenResponse).not.toContain('OSHA 1910.147');});
});
