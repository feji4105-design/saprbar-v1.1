/** Generate the report itself, bypassing browser print headers (page title and URL). */
export async function exportReportPdf(source:HTMLElement,filename:string,isCurrent:()=>boolean=()=>true):Promise<boolean> {
  if(!isCurrent())return false;
  const {default:html2pdf}=await import('html2pdf.js');
  if(!isCurrent())return false;
  const clone=source.cloneNode(true) as HTMLElement;
  clone.style.width='170mm';clone.style.maxWidth='170mm';clone.style.padding='0';clone.style.margin='0';
  clone.style.fontSize=clone.classList.contains('rgr-short')?'11pt':'12pt';
  const title=clone.querySelector<HTMLElement>('.rgr-title-page');
  if(title){title.style.minHeight='240mm';title.style.breakAfter='page';}
  const stage=document.createElement('div');stage.className='rgr-pdf-stage';stage.setAttribute('aria-hidden','true');
  stage.style.cssText='position:fixed;left:-10000px;top:0;width:170mm;background:white;pointer-events:none';
  stage.append(clone);document.body.append(stage);
  try {
    await document.fonts?.ready;
    if(!isCurrent())return false;
    const settings={
      filename,margin:20,
      image:{type:'jpeg' as const,quality:.98},
      html2canvas:{scale:2,backgroundColor:'#ffffff',windowWidth:1200,scrollX:0,scrollY:0},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait' as const},
      pagebreak:{mode:['css','legacy'],avoid:['p','tr','svg','h2','h3']}
    };
    const worker=html2pdf().set(settings).from(clone);
    await worker.toPdf();
    if(!isCurrent())return false;
    await worker.save();
    return true;
  } finally { stage.remove(); }
}
