import React from 'react';
import { cn } from '../../lib/utils';
import { LandingComponent, FormField, ComponentPropValue } from '../../lib/builder/types';

export interface BlockProps {
  component: LandingComponent;
  isSelected?: boolean;
  onClick?: () => void;
}

const getString = (v: ComponentPropValue, f = '') => typeof v === 'string' ? v : f;
const getNumber = (v: ComponentPropValue, f = 0) => typeof v === 'number' ? v : f;
const getFormFields = (v: ComponentPropValue): FormField[] => Array.isArray(v) ? v.filter((i): i is FormField => typeof i === 'object' && i !== null && 'label' in i) : [];

const BlockWrapper = ({ children, isSelected, onClick }: { children: React.ReactNode; isSelected?: boolean; onClick?: () => void }) => (
  <div className={cn(isSelected ? 'ring-2 ring-primary ring-offset-2' : 'hover:ring-1 hover:ring-primary/50')} onClick={onClick}>
    {children}
  </div>
);

const FeatureIcon = () => (
  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  </div>
);

const PricingCard = ({ i }: { i: number }) => (
  <div className="bg-white p-8 rounded-lg shadow-sm border">
    <h3 className="text-xl font-semibold mb-4">Plan {i}</h3>
    <p className="text-4xl font-bold mb-6">${i * 10}<span className="text-base font-normal text-gray-500">/mo</span></p>
    <ul className="space-y-3 text-left mb-8">
      {[1, 2, 3].map((n) => <li key={n} className="flex items-center text-sm text-gray-600">✓ Feature {n}</li>)}
    </ul>
    <button className="w-full py-2 px-4 border border-primary text-primary rounded hover:bg-primary/5">Choose Plan</button>
  </div>
);

const TestimonialCard = ({ i }: { i: number }) => (
  <div className="p-6 bg-gray-50 rounded-lg">
    <p className="text-lg italic text-gray-600 mb-6">"This product completely changed how we work. Highly recommended!"</p>
    <div className="flex items-center justify-center gap-4">
      <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
      <div className="text-left">
        <div className="font-semibold">User Name</div>
        <div className="text-sm text-gray-500">CEO, Company {i}</div>
      </div>
    </div>
  </div>
);

const FONT_SIZES = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' };
const VARIANTS = { primary: "bg-primary text-primary-foreground hover:bg-primary/90", secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80", outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground" };

export const HeroBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => {
  const { title, subtitle, ctaText, ctaLink, backgroundImage, alignment } = component.props;
  const bgImage = getString(backgroundImage);
  return (
    <div className={cn("relative py-20 px-6 flex flex-col justify-center min-h-[400px] bg-cover bg-center", alignment === 'center' ? 'items-center text-center' : 'items-start text-left', isSelected && 'ring-2 ring-primary ring-offset-2')} style={{ backgroundImage: bgImage ? `url(${bgImage})` : undefined }} onClick={onClick}>
      {!bgImage && <div className="absolute inset-0 bg-gray-100 -z-10" />}
      <div className="absolute inset-0 bg-black/10 -z-10" />
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-4 drop-shadow-sm">{getString(title)}</h1>
      <p className="text-xl text-gray-700 mb-8 max-w-2xl drop-shadow-sm">{getString(subtitle)}</p>
      <a href={getString(ctaLink)} className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 py-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={(e) => e.preventDefault()}>{getString(ctaText)}</a>
    </div>
  );
};

export const FeaturesBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => {
  const cols = getNumber(component.props.columns, 3);
  return (
    <BlockWrapper isSelected={isSelected} onClick={onClick}>
      <div className="py-16 px-6 bg-white max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">{getString(component.props.title)}</h2>
        <div className={`grid gap-8 grid-cols-1 md:grid-cols-${cols}`}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="p-6 border rounded-lg shadow-sm">
              <FeatureIcon />
              <h3 className="text-xl font-semibold mb-2">Feature {i + 1}</h3>
              <p className="text-gray-600">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            </div>
          ))}
        </div>
      </div>
    </BlockWrapper>
  );
};

export const CtaBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => (
  <BlockWrapper isSelected={isSelected} onClick={onClick}>
    <div className="py-16 px-6 text-center" style={{ backgroundColor: getString(component.props.backgroundColor) }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">{getString(component.props.title)}</h2>
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 py-2 bg-primary text-primary-foreground hover:bg-primary/90">{getString(component.props.buttonText)}</button>
      </div>
    </div>
  </BlockWrapper>
);

export const PricingBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => (
  <BlockWrapper isSelected={isSelected} onClick={onClick}>
    <div className="py-16 px-6 bg-gray-50 max-w-7xl mx-auto text-center">
      <h2 className="text-3xl font-bold mb-12">{getString(component.props.title)}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">{[1, 2, 3].map((i) => <PricingCard key={i} i={i} />)}</div>
    </div>
  </BlockWrapper>
);

export const TestimonialsBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => (
  <BlockWrapper isSelected={isSelected} onClick={onClick}>
    <div className="py-16 px-6 bg-white max-w-7xl mx-auto text-center">
      <h2 className="text-3xl font-bold mb-12">{getString(component.props.title)}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">{[1, 2].map((i) => <TestimonialCard key={i} i={i} />)}</div>
    </div>
  </BlockWrapper>
);

export const TextBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => (
  <BlockWrapper isSelected={isSelected} onClick={onClick}>
    <div className="py-6 px-6 max-w-4xl mx-auto">
      <div className={cn("prose max-w-none text-gray-700", FONT_SIZES[getString(component.props.fontSize, 'base') as keyof typeof FONT_SIZES])}>{getString(component.props.content)}</div>
    </div>
  </BlockWrapper>
);

export const ImageBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => (
  <BlockWrapper isSelected={isSelected} onClick={onClick}>
    <div className="p-4 flex justify-center"><img src={getString(component.props.src)} alt={getString(component.props.alt)} className="max-w-full h-auto rounded-lg shadow-sm" /></div>
  </BlockWrapper>
);

export const ButtonBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => (
  <BlockWrapper isSelected={isSelected} onClick={onClick}>
    <div className="p-4 flex justify-center">
      <a href={getString(component.props.link)} className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2", VARIANTS[getString(component.props.variant, 'primary') as keyof typeof VARIANTS])} onClick={(e) => e.preventDefault()}>{getString(component.props.text)}</a>
    </div>
  </BlockWrapper>
);

export const FormBlock: React.FC<BlockProps> = ({ component, isSelected, onClick }) => {
  const fields = getFormFields(component.props.fields);
  return (
    <BlockWrapper isSelected={isSelected} onClick={onClick}>
      <div className="py-12 px-6 bg-gray-50">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-sm">
          <h3 className="text-2xl font-bold text-center mb-6">{getString(component.props.title)}</h3>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            {fields.map((field, idx) => (
              <div key={idx} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                <input type={field.type || 'text'} placeholder={field.placeholder} className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" disabled />
              </div>
            ))}
            {fields.length === 0 && <div className="text-sm text-gray-500 italic text-center p-4 border border-dashed rounded">No fields configured.</div>}
            <button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md text-sm font-medium" disabled>{getString(component.props.submitText)}</button>
          </form>
        </div>
      </div>
    </BlockWrapper>
  );
};

